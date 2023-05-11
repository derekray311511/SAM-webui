from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
from segment_anything import sam_model_registry, SamPredictor, SamAutomaticMaskGenerator
from typing import Any, Dict, List
from arg_parse import parser
from utils import mkdir_or_exist
from collections import deque
import threading
import queue
import cv2
import numpy as np
import io, os
import time
import base64
import argparse
import torch
import torchvision

print("PyTorch version:", torch.__version__)
print("Torchvision version:", torchvision.__version__)
print("CUDA is available:", torch.cuda.is_available())

class Mode:
    def __init__(self) -> None:
        self.IAMGE = 1
        self.MASKS = 2
        self.CLEAR = 3
        self.P_POINT = 4
        self.N_POINT = 5
        self.BOXES = 6
        self.INFERENCE = 7
        self.UNDO = 8
        self.COLOR_MASKS = 9

MODE = Mode()

class SamAutoMaskGen:
    def __init__(self, model, args) -> None:
        output_mode = "coco_rle" if args.convert_to_rle else "binary_mask"
        self.amg_kwargs = self.get_amg_kwargs(args)
        self.generator = SamAutomaticMaskGenerator(model, output_mode=output_mode, **self.amg_kwargs)

    def get_amg_kwargs(self, args):
        amg_kwargs = {
            "points_per_side": args.points_per_side,
            "points_per_batch": args.points_per_batch,
            "pred_iou_thresh": args.pred_iou_thresh,
            "stability_score_thresh": args.stability_score_thresh,
            "stability_score_offset": args.stability_score_offset,
            "box_nms_thresh": args.box_nms_thresh,
            "crop_n_layers": args.crop_n_layers,
            "crop_nms_thresh": args.crop_nms_thresh,
            "crop_overlap_ratio": args.crop_overlap_ratio,
            "crop_n_points_downscale_factor": args.crop_n_points_downscale_factor,
            "min_mask_region_area": args.min_mask_region_area,
        }
        amg_kwargs = {k: v for k, v in amg_kwargs.items() if v is not None}
        return amg_kwargs

    def generate(self, image) -> np.ndarray:
        masks = self.generator.generate(image)
        np_masks = []
        for i, mask_data in enumerate(masks):
            mask = mask_data["segmentation"]
            np_masks.append(mask)

        return np.array(np_masks, dtype=bool)

class SAM_Web_App:
    def __init__(self, args):
        self.app = Flask(__name__)
        CORS(self.app)
        
        self.args = args

        # load model
        print("Loading model...", end="")
        device = args.device
        print(f"using {device}...", end="")
        sam = sam_model_registry[args.model_type](checkpoint=args.checkpoint)
        sam.to(device=device)

        self.predictor = SamPredictor(sam)
        self.autoPredictor = SamAutoMaskGen(sam, args)
        print("Done")

        # Store the image globally on the server
        self.origin_image = None
        self.processed_img = None
        self.masked_img = None
        self.colorMasks = None
        self.imgSize = None
        self.imgIsSet = False           # To run self.predictor.set_image() or not
        self.blurLevel = 0              # Blur the cutout image

        self.mode = "p_point"           # p_point / n_point / box
        self.curr_view = "image"
        self.queue = deque(maxlen=1000)  # For undo list
        self.prev_inputs = deque(maxlen=500)

        self.points = []
        self.points_label = []
        self.boxes = []
        self.masks = []

        # Set the default save path to the Downloads folder
        home_dir = os.path.expanduser("~")
        self.save_path = os.path.join(home_dir, "Downloads")

        self.app.route('/', methods=['GET'])(self.home)
        self.app.route('/upload_image', methods=['POST'])(self.upload_image)
        self.app.route('/button_click', methods=['POST'])(self.button_click)
        self.app.route('/point_click', methods=['POST'])(self.handle_mouse_click)
        self.app.route('/box_receive', methods=['POST'])(self.box_receive)
        self.app.route('/set_save_path', methods=['POST'])(self.set_save_path)
        self.app.route('/save_image', methods=['POST'])(self.save_image)
        self.app.route('/send_stroke_data', methods=['POST'])(self.handle_stroke_data)
        self.app.route('/apply_blur', methods=['POST'])(self.apply_blur)

    def home(self):
        return render_template('index.html', default_save_path=self.save_path)
    
    def blurMaskedImage(self, image, masks, blurLevel):
        total_mask = cv2.cvtColor(masks, cv2.COLOR_BGR2GRAY)
        total_mask = total_mask > 0    # Region to preserve
        alpha_channel = np.zeros(image.shape[:2], dtype=np.uint8)
        alpha_channel[total_mask] = 255
        alpha_channel = cv2.GaussianBlur(alpha_channel, (blurLevel, blurLevel), 0) / 255.
        alpha_channel = alpha_channel[:, :, np.newaxis]
        image = (image * alpha_channel).astype(np.uint8)
        return image
    
    def apply_blur(self):
        self.blurLevel = int(request.form['blurLevel'])
        self.blurLevel += self.blurLevel % 2 + 1
        self.masked_img = self.blurMaskedImage(self.origin_image, self.colorMasks, self.blurLevel)
        
        if self.curr_view == "masks":
            processed_image = self.masked_img
        elif self.curr_view == "colorMasks":
            processed_image = self.colorMasks
        else:   # self.curr_view == "image":
            processed_image = self.processed_img

        _, buffer = cv2.imencode('.jpg', processed_image)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return jsonify({'image': img_base64})
    
    def set_save_path(self):
        self.save_path = request.form.get("save_path")

        # Perform your server-side checks on the save_path here
        # e.g., check if the path exists, if it is writable, etc.
        if os.path.isdir(self.save_path):
            print(f"Set save path to: {self.save_path}")
            return jsonify({"status": "success", "message": "Save path set successfully"})
        else:
            return jsonify({"status": "error", "message": "Invalid save path"}), 400
        
    def save_image(self):
        # Save the colorMasks
        saveType = request.form.get("saveType")
        filename = request.form.get("filename")
        if filename == "":
            return jsonify({"status": "error", "message": "No image to save"}), 400
        
        # Select the appropriate image based on the saveType
        if saveType == "colorMasks":
            img_to_save = self.colorMasks
        elif saveType == "masked_img":
            img_to_save = self.masked_img
        elif saveType == "processed_img":
            img_to_save = self.processed_img
        else:
            return jsonify({"status": "error", "message": "Invalid save type"}), 400
        
        # Add alpha channel to cutout image (masked image) to save with transparent image
        if saveType == "masked_img":
            total_mask = cv2.cvtColor(self.colorMasks, cv2.COLOR_BGR2GRAY)
            total_mask = total_mask > 0    # Region to preserve
            alpha_channel = np.zeros(img_to_save.shape[:2], dtype=np.uint8)
            alpha_channel[total_mask] = 255
            # Stack the data in the three image channels with the alpha channel
            img_to_save = cv2.merge((img_to_save, alpha_channel))
        
        print(f"Saving {saveType} type image: {filename} ...", end="")
        dirname = os.path.join(self.save_path, filename)
        mkdir_or_exist(dirname)
        # Get the number of existing files in the save_folder
        num_files = len([f for f in os.listdir(dirname) if os.path.isfile(os.path.join(dirname, f))])
        # Create a unique file name based on the number of existing files
        savename = f"{num_files}.png"
        save_path = os.path.join(dirname, savename)
        try:
            # encoded_img = cv2.imencode(".png", img_to_save)[1]
            # encoded_img.tofile(save_path)
            cv2.imwrite(save_path, img_to_save)
            print("Done!")
            return jsonify({"status": "success", "message": f"Image saved to {save_path}"})
        except:
            return jsonify({"status": "error", "message": "Imencode error"}), 400

    def upload_image(self):
        if 'image' not in request.files:
            return jsonify({'error': 'No image in the request'}), 400

        file = request.files['image']
        image = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)

        # Store the image globally
        self.origin_image = image
        self.processed_img = image
        self.masked_img = np.zeros_like(image)
        self.colorMasks = np.zeros_like(image)
        self.imgSize = image.shape
        print(f"Loaded image with size {self.imgSize}")

        # Create image imbedding
        # self.predictor.set_image(image, image_format="RGB")   # Move to first inference

        # Reset inputs and masks and image ebedding
        self.imgIsSet = False
        self.reset_inputs()
        self.reset_masks()
        self.queue.clear()
        self.prev_inputs.clear()
        torch.cuda.empty_cache()

        return "Uploaded image, successfully initialized"

    def button_click(self):
        if self.processed_img is None:
            return jsonify({'error': 'No image available for processing'}), 400

        data = request.get_json()
        button_id = data['button_id']
        print(f"Button {button_id} clicked")

        # Info
        info = {
            'event': 'button_click',
            'data': button_id
        }

        # Process and return the image
        return self.process_image(self.processed_img, info)

    def handle_mouse_click(self):
        if self.processed_img is None:
            return jsonify({'error': 'No image available for processing'}), 400

        data = request.get_json()
        x = data['x']
        y = data['y']
        print(f'Point clicked at: {x}, {y}')
        self.points.append(np.array([x, y], dtype=np.float32))
        self.points_label.append(1 if self.mode == 'p_point' else 0)

        # Add command to queue list
        self.queue.append("point")

        # Process and return the image
        return f"Click at image pos {x}, {y}"
    
    def handle_stroke_data(self):
        data = request.get_json()
        stroke_data = data['stroke_data']

        print("Received stroke data")

        if len(stroke_data) == 0:
            pass
        else:
            # Process the stroke data here
            stroke_img = np.zeros_like(self.origin_image)
            print(f"stroke data len: {len(stroke_data)}")

            latestData = stroke_data[len(stroke_data) - 1]
            strokes, size = latestData['Stroke'], latestData['Size']
            BGRcolor = (latestData['Color']['b'], latestData['Color']['g'], latestData['Color']['r'])
            Rpos, Bpos = 2, 0
            stroke_data_cv2 = []
            for stroke in strokes:
                stroke_data_cv2.append((int(stroke['x']), int(stroke['y'])))
            for i in range(len(strokes) - 1):
                cv2.line(stroke_img, stroke_data_cv2[i], stroke_data_cv2[i + 1], BGRcolor, size)

            if BGRcolor[0] == 255:
                mask = np.squeeze(stroke_img[:, :, Bpos] == 0)
                opt = "negative"
            else: # np.where(BGRcolor == 255)[0] == Rpos
                mask = np.squeeze(stroke_img[:, :, Rpos] > 0)
                opt = "positive"

            self.masks.append({
                "mask": mask,
                "opt": opt
            })

        self.get_colored_masks_image()
        self.processed_img, maskedImage = self.updateMaskImg(self.origin_image, self.masks)
        self.masked_img = maskedImage
        self.queue.append("brush")

        if self.curr_view == "masks":
            print("view masks")
            processed_image = self.masked_img
        elif self.curr_view == "colorMasks":
            print("view color")
            processed_image = self.colorMasks
        else:   # self.curr_view == "image":
            print("view image")
            processed_image = self.processed_img

        _, buffer = cv2.imencode('.jpg', processed_image)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return jsonify({'image': img_base64})
    
    def box_receive(self):
        if self.processed_img is None:
            return jsonify({'error': 'No image available for processing'}), 400

        data = request.get_json()
        self.boxes.append(np.array([
            data['x1'], data['y1'],
            data['x2'], data['y2']
        ], dtype=np.float32))

        # Add command to queue list
        self.queue.append("box")

        return "server received boxes"

    def process_image(self, image, info):
        processed_image = image

        if info['event'] == 'button_click':
            id = info['data']
            if (id == MODE.IAMGE):
                self.curr_view = "image"
                processed_image = self.processed_img
            elif (id == MODE.MASKS):
                self.curr_view = "masks"
                processed_image = self.masked_img
            elif (id == MODE.COLOR_MASKS):
                self.curr_view = "colorMasks"
                processed_image = self.colorMasks
            elif (id == MODE.CLEAR):
                processed_image = self.origin_image
                self.processed_img = self.origin_image
                self.reset_inputs()
                self.reset_masks()  
                self.queue.clear()
                self.prev_inputs.clear()
            elif (id == MODE.P_POINT):
                self.mode = "p_point"
            elif (id == MODE.N_POINT):
                self.mode = "n_point"
            elif (id == MODE.BOXES):
                self.mode = "box"
            elif (id == MODE.INFERENCE):
                print("INFERENCE")
                # self.reset_masks()
                points = np.array(self.points)
                labels = np.array(self.points_label)
                boxes = np.array(self.boxes)
                print(f"Points shape {points.shape}")
                print(f"Labels shape {labels.shape}")
                print(f"Boxes shape {boxes.shape}")
                prev_masks_len = len(self.masks)
                processed_image, self.masked_img = self.inference(self.origin_image, points, labels, boxes)
                curr_masks_len = len(self.masks)
                self.get_colored_masks_image()
                self.processed_img = processed_image
                self.prev_inputs.append({
                    "points": self.points,
                    "labels": self.points_label,
                    "boxes": self.boxes
                })
                self.reset_inputs()
                self.queue.append(f"inference-{curr_masks_len - prev_masks_len}")

            elif (id == MODE.UNDO):
                if len(self.queue) != 0:
                    command = self.queue.pop()
                    command = command.split('-')
                else:
                    command = None
                print(f"Undo {command}")

                if command is None:
                    pass
                elif command[0] == "point":
                    self.points.pop()
                    self.points_label.pop()
                elif command[0] == "box":
                    self.boxes.pop()
                elif command[0] == "inference":
                    # Calculate masks and image again
                    val = command[1]
                    self.masks = self.masks[:(len(self.masks) - int(val))]
                    self.processed_img, self.masked_img = self.updateMaskImg(self.origin_image, self.masks)
                    self.get_colored_masks_image()

                    # Load prev inputs
                    prev_inputs = self.prev_inputs.pop()
                    self.points = prev_inputs["points"]
                    self.points_label = prev_inputs["labels"]
                    self.boxes = prev_inputs["boxes"]
                elif command[0] == "brush":
                    self.masks.pop()
                    self.processed_img, self.masked_img = self.updateMaskImg(self.origin_image, self.masks)
                    self.get_colored_masks_image()
                
        # Apply blur to self.masked_img with self.blurLevel
        self.masked_img = self.blurMaskedImage(self.origin_image, self.colorMasks, self.blurLevel)

        if self.curr_view == "masks":
            processed_image = self.masked_img
        elif self.curr_view == "colorMasks":
            processed_image = self.colorMasks
        else:   # self.curr_view == "image":
            processed_image = self.processed_img

        _, buffer = cv2.imencode('.jpg', processed_image)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return jsonify({'image': img_base64})
    
    def inference(self, image, points, labels, boxes) -> np.ndarray:

        points_len, lables_len, boxes_len = len(points), len(labels), len(boxes)
        if (len(points) == len(labels) == 0):
            points = labels = None
        if (len(boxes) == 0):
            boxes = None

        # Image is set ?
        if self.imgIsSet == False:
            self.predictor.set_image(image, image_format="RGB")
            self.imgIsSet = True
            print("Image set!")

        # Auto 
        if (points_len == boxes_len == 0):
            masks = self.autoPredictor.generate(image)
            for mask in masks:
                self.masks.append({
                    "mask": mask,
                    "opt": "positive"
                })

        # One Object
        elif ((boxes_len == 1) or (points_len > 0 and boxes_len <= 1)):
            masks, scores, logits = self.predictor.predict(
                point_coords=points,
                point_labels=labels,
                box=boxes,
                multimask_output=True,
            )
            max_idx = np.argmax(scores)
            self.masks.append({
                "mask": masks[max_idx],
                "opt": "positive"
            })

        # Multiple Object
        elif (boxes_len > 1):
            boxes = torch.tensor(boxes, device=self.predictor.device)
            transformed_boxes = self.predictor.transform.apply_boxes_torch(boxes, image.shape[:2])
            masks, scores, logits = self.predictor.predict_torch(
                point_coords=None,
                point_labels=None,
                boxes=transformed_boxes,
                multimask_output=False,
            )
            masks = masks.detach().cpu().numpy()
            scores = scores.detach().cpu().numpy()
            max_idxs = np.argmax(scores, axis=1)
            print(f"output mask shape: {masks.shape}")  # (batch_size) x (num_predicted_masks_per_input) x H x W
            for i in range(masks.shape[0]):
                self.masks.append({
                    "mask": masks[i][max_idxs[i]],
                    "opt": "positive"
                })

        # Update masks image to show
        overlayImage, maskedImage = self.updateMaskImg(self.origin_image, self.masks)
        # overlayImage, maskedImage = self.updateMaskImg(overlayImage, maskedImage, [self.brushMask])

        return overlayImage, maskedImage

    def updateMaskImg(self, image, masks):

        if (len(masks) == 0 or masks[0] is None):
            print(masks)
            return image, np.zeros_like(image)
        
        union_mask = np.zeros_like(image)[:, :, 0]
        np.random.seed(0)
        for i in range(len(masks)):
            if masks[i]['opt'] == "negative":
                image = self.clearMaskWithOriginImg(self.origin_image, image, masks[i]['mask'])
                union_mask = np.bitwise_and(union_mask, masks[i]['mask'])
            else:
                image = self.overlay_mask(image, masks[i]['mask'], 0.5, random_color=(len(masks) > 1))
                union_mask = np.bitwise_or(union_mask, masks[i]['mask'])
        
        # Cut out objects using union mask
        masked_image = self.origin_image * union_mask[:, :, np.newaxis]
        
        return image, masked_image

    # Function to overlay a mask on an image
    def overlay_mask(
        self, 
        image: np.ndarray, 
        mask: np.ndarray, 
        alpha: float, 
        random_color: bool = False,
    ) -> np.ndarray:
        """ Draw mask on origin image

        parameters:
        image:  Origin image
        mask:   Mask that have same size as image
        color:  Mask's color in BGR
        alpha:  Transparent ratio from 0.0-1.0

        return:
        blended: masked image
        """
        # Blend the image and the mask using the alpha value
        if random_color:
            color = np.random.random(3)
        else:
            color = np.array([30/255, 144/255, 255/255])    # BGR
        h, w = mask.shape[-2:]
        mask = mask.reshape(h, w, 1) * color.reshape(1, 1, -1)
        mask *= 255 * alpha
        mask = mask.astype(dtype=np.uint8)
        blended = cv2.add(image, mask)
        
        return blended
    
    def get_colored_masks_image(self):
        masks = self.masks
        darkImg = np.zeros_like(self.origin_image)
        image = darkImg.copy()

        np.random.seed(0)
        if (len(masks) == 0):
            self.colorMasks = image
            return image
        for mask in masks:
            if mask['opt'] == "negative":
                image = self.clearMaskWithOriginImg(darkImg, image, mask['mask'])
            else:
                image = self.overlay_mask(image, mask['mask'], 0.5, random_color=(len(masks) > 1))

        self.colorMasks = image
        return image
    
    def clearMaskWithOriginImg(self, originImage, image, mask):
        originImgPart = originImage * np.invert(mask)[:, :, np.newaxis]
        image = image * mask[:, :, np.newaxis]
        image = cv2.add(image, originImgPart)
        return image
    
    def reset_inputs(self):
        self.points = []
        self.points_label = []
        self.boxes = []

    def reset_masks(self):
        self.masks = []
        self.masked_img = np.zeros_like(self.origin_image)
        self.colorMasks = np.zeros_like(self.origin_image)

    def run(self, debug=True):
        self.app.run(debug=debug, port=8989)


if __name__ == '__main__':
    args = parser().parse_args()
    app = SAM_Web_App(args)
    app.run(debug=True)