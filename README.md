# SAM-webui
<img src="https://user-images.githubusercontent.com/84118285/232520114-e737f6f7-55d5-465c-b7b7-8c15059e8384.gif" width="600"/>
<img src="https://user-images.githubusercontent.com/84118285/232520000-6606629d-f375-4fe7-b88f-b08f0eb64321.gif" width="600"/>
<img src="https://user-images.githubusercontent.com/84118285/232520088-47c8879a-2c0f-45cf-aa1e-acd5a6a8591a.gif" width="600"/>

# News
- Release code

# Features

- Preview Images
- Multi-View Switch
- SAM Point Segmentation
- SAM Box Segmentation
- SAM Auto Segmentation
- Undo
- Clear
- Save Masks
- Zoom in / out
- You can find shortcuts when mouse hovering on buttons!

# Install
The code requires `python>=3.8`, as well as `pytorch>=1.7` and `torchvision>=0.8`. Please follow the instructions [here](https://pytorch.org/get-started/locally/) to install both PyTorch and TorchVision dependencies. Installing both PyTorch and TorchVision with CUDA support is strongly recommended.

We have tested:
`Python 3.8`
`pytorch 2.0.0 (py3.8_cuda11.7_cudnn8.5.0_0)`
`torchvision 0.15.0`

```bash
git clone https://github.com/derekray311511/SAM-webui.git
cd SAM-webui; pip install -e .
```
```bash!
pip install opencv-python pycocotools matplotlib onnxruntime onnx flask flask_cors
```

## Model Checkpoints
You can download the model checkpoints [here](https://github.com/facebookresearch/segment-anything#model-checkpoints).  

# Run

MODEL_TYPE: `vit_h`, `vit_l`, `vit_b`
```bash!
python app.py --model_type vit_h --checkpoint ../models/sam_vit_h_4b8939.pth
```

If you want to run on cpu, 
```bash!
python app.py --model_type vit_h --checkpoint ../models/sam_vit_h_4b8939.pth --device cpu
```

# Credits

- Segment-Anything - https://github.com/facebookresearch/segment-anything
