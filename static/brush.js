// Add this to the beginning of your script
const imageCanvas = document.getElementById('image-canvas');
const imageCtx = imageCanvas.getContext('2d');
const brushPreviewCanvas = document.getElementById('brush-preview-canvas');
const brushPreviewCtx = brushPreviewCanvas.getContext('2d');
const brushSizeSlider = document.getElementById('brush-size-slider');
brushPreviewCanvas.style.pointerEvents = 'none';

const maxUndoStackSize = 1000; // Set the maximum number of elements for the undo stack
const undoStack = [];
let AllStrokes = [];
let currStrokeData = {};
let currentStroke = [];
const drawColor = {r: 255, g:0, b:0, a:0.2};
const deleteColor = {r: 0, g:0, b:255, a:0.2};
let brushColor = drawColor;
const magic_value = 8;

// Variables for the brush tool
let isBrushEnabled = false;
let isDrawing = false;

// Function to enable the brush tool
function enableBrush() {
    isBrushEnabled = true;
    imageCanvas.style.pointerEvents = 'auto';
    imageCtx.strokeStyle = `rgba(${brushColor.r}, ${brushColor.g}, ${brushColor.b}, ${brushColor.a})`;
    imageCtx.lineWidth = brushSizeSlider.value; // Change this to the brush width you want
    imageCtx.lineJoin = 'round';
    imageCtx.lineCap = 'round';
    brushPreviewCanvas.style.display = 'block';
    brushPreviewCtx.lineWidth = brushSizeSlider.value;
    brushPreviewCtx.lineCap = 'round';
}

// Function to disable the brush tool
function disableBrush() {
    isBrushEnabled = false;
    imageCanvas.style.pointerEvents = 'none';
    brushPreviewCanvas.style.display = 'none';
}

function updateBrushSize() {
    imageCtx.lineWidth = brushSizeSlider.value;
    brushPreviewCtx.lineWidth = brushSizeSlider.value;
}
// Add this line after the other event listeners in your script
document.getElementById('brush-size-slider').addEventListener('input', updateBrushSize);

// Get mosue pos relative to the canvas
function getMousePos(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

// Get mouse pos relative to the original image
function getTrueMousePos(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = $('#preview').data('originalWidth') / canvas.width;
    const scaleY = $('#preview').data('originalHeight') / canvas.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

// Function to start drawing
function startDrawing(e) {
    if (e.ctrlKey) {    // If ctrl is pressed, prevent this event handler from executing
        return;
    }
    if (!isBrushEnabled) return;
    isDrawing = true;
    // Check if the undo stack has reached the maximum size
    if (undoStack.length >= maxUndoStackSize) {
        // Remove the oldest canvas state from the stack
        undoStack.shift();
    }
    if (e.altKey) {
        brushColor = deleteColor;
    } else {
        brushColor = drawColor;
    }
    imageCtx.strokeStyle = `rgba(${brushColor.r}, ${brushColor.g}, ${brushColor.b}, ${brushColor.a})`;
    // Save the current canvas state before starting a new drawing
    // undoStack.push(imageCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height));
    const mousePos = getMousePos(imageCanvas, e);
    const trueMousePos = getTrueMousePos(imageCanvas, e);
    currentStroke.push({ x: trueMousePos.x, y: trueMousePos.y });
    currentStroke.push({ x: trueMousePos.x, y: trueMousePos.y });
    imageCtx.beginPath();
    imageCtx.moveTo(mousePos.x, mousePos.y);
    imageCtx.lineTo(mousePos.x, mousePos.y);
    imageCtx.stroke();
}

// Function to draw
function draw(e) {

    const offset = $('#preview').offset();
    lastMouseX = e.pageX - offset.left;
    lastMouseY = e.pageY - offset.top;
    if (zoomEnabled) {
        zoomContainer.style.left = (e.pageX + 10) + "px";
        zoomContainer.style.top = (e.pageY - 10 - zoomContainer.clientHeight) + "px";
        updateZoomImage(lastMouseX, lastMouseY);
    }

    if (e.ctrlKey) {    // If ctrl is pressed, prevent this event handler from executing
        return;
    }
    if (!isDrawing) return;
    const mousePos = getMousePos(imageCanvas, e);
    const trueMousePos = getTrueMousePos(imageCanvas, e);
    currentStroke.push({ x: trueMousePos.x, y: trueMousePos.y });
    imageCtx.lineTo(mousePos.x, mousePos.y);
    imageCtx.stroke();
}

// Function to stop drawing
function stopDrawing() {
    if (!isBrushEnabled) return;
    isDrawing = false;
    queue.push("brush");

    // Send the current stroke to the server
    const ratio = get_img_ratio();
    const size = Math.round(ratio.scaleX * brushSizeSlider.value);
    currStrokeData = {
        Stroke: currentStroke,
        Size: size,
        Color: brushColor
    }
    AllStrokes.push(currStrokeData);
    sendStrokeDataToServer(AllStrokes);
    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    currentStroke = []; // Reset the current stroke
}

// Function to send stroke data to the server
function sendStrokeDataToServer(strokeData) {
    // Send the stroke data to the server
    $.ajax({
        url: "/send_stroke_data",
        type: "POST",
        data: JSON.stringify({ 
            stroke_data: strokeData,
        }),
        contentType: "application/json",
        success: function (response) {
            const image = new Image();
            image.src = "data:image/jpeg;base64," + response.image;
            image.onload = function () {
                $("#preview").attr("src", image.src);
                $('#zoom-image').attr('src', image.src);
            };
        },
        error: function (error) {
            console.error(error);
        }
    });
}

// Get preview image and origin image ratio
function get_img_ratio() {
    const scaleX = $('#preview').data('originalWidth') / imageCanvas.width;
    const scaleY = $('#preview').data('originalHeight') / imageCanvas.height;
    return {
        scaleX: scaleX,
        scaleY: scaleY
    };
}

function changeBrushSize(e) {
    if (!isBrushEnabled) return;
    const brushSizeSlider = document.getElementById('brush-size-slider');
    let currentBrushSize = parseInt(brushSizeSlider.value);
    const brushSizeStep = 5; // Change this value to control the size increment/decrement

    if (e.key === '+' || e.key === '=') {
        currentBrushSize += brushSizeStep;
    } else if (e.key === '-' || e.key === '_') {
        currentBrushSize -= brushSizeStep;
    } else {
        // If the pressed key is not + or -, ignore the event
        return;
    }
    currentBrushSize = Math.max(brushSizeSlider.min, Math.min(brushSizeSlider.max, currentBrushSize));
    brushSizeSlider.value = currentBrushSize;
    updateBrushSize();
    drawBrushPreviewOnce();
}
document.addEventListener('keydown', changeBrushSize);
document.addEventListener("keydown", function (e) {
    if (e.key === "Alt") {
        e.preventDefault();
        brushColor = deleteColor;
        drawBrushPreviewOnce();
    }
    else if (e.key === "q") {
        buttonClick("brush");
    }
});

document.addEventListener("keyup", function (e) {
    if (e.key === "Alt") {
        brushColor = drawColor;
        drawBrushPreviewOnce();
    }
});

$("#image-canvas").on("wheel", function (e) {
    if (zoomEnabled && isBrushEnabled) {
        const offset = $(this).offset();
        const mouseX = e.pageX - offset.left;
        const mouseY = e.pageY - offset.top;

        updateZoomImage(mouseX, mouseY);
    }
});

brushSizeSlider.addEventListener('wheel', function(event) {
    var isFocused = (document.activeElement === brushSizeSlider);
    if (!isFocused) {
        return;
    }
    event.preventDefault();  // Prevents the default scroll behavior
    if (event.deltaY < 0) {
        // If the mouse wheel is scrolled up, increase the value of the slider
        brushSizeSlider.stepUp();
    } else {
        // If the mouse wheel is scrolled down, decrease the value of the slider
        brushSizeSlider.stepDown();
    }
    updateBrushSize();
});

// Add event listeners for the brush tool
imageCanvas.addEventListener('mousedown', startDrawing);
imageCanvas.addEventListener('mousemove', draw);
imageCanvas.addEventListener('mouseup', stopDrawing);
// imageCanvas.addEventListener('mouseout', stopDrawing);

// Add event listeners for the brush preview
imageCanvas.addEventListener('mousemove', drawBrushPreview);
imageCanvas.addEventListener('mouseout', () => {
    brushPreviewCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
});

document.getElementById('brush').addEventListener('click', function() {
    console.log('brush button clicked');
});

// Update the canvas size after loading the image
function updateCanvasSize() {
    // Save the current canvas content
    const currentCanvasContent = imageCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);

    // Update the canvas size
    imageCanvas.width = $('#preview').width();
    imageCanvas.height = $('#preview').height();
    imageCtx.lineWidth = brushSizeSlider.value;
    
    // Update the brush preview canvas size
    updateBrushPreviewCanvasSize();

    // Draw the saved content back onto the canvas
    imageCtx.putImageData(currentCanvasContent, 0, 0);
}

function updateBrushPreviewCanvasSize() {
    brushPreviewCanvas.width = imageCanvas.width;
    brushPreviewCanvas.height = imageCanvas.height;
    brushPreviewCtx.lineWidth = brushSizeSlider.value;
    brushPreviewCtx.lineCap = 'round';
}

// function to draw the brush preview
function drawBrushPreview(e) {
    if (!isBrushEnabled) return;
    if (e.altKey) {
        brushColor = deleteColor;
    } else {
        brushColor = drawColor;
    }
    const mousePos = getMousePos(brushPreviewCanvas, e);
    brushPreviewCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
    brushPreviewCtx.beginPath();
    brushPreviewCtx.arc(mousePos.x, mousePos.y, (brushPreviewCtx.lineWidth / (2 * magic_value)), 0, 2 * Math.PI);
    brushPreviewCtx.strokeStyle = `rgba(${brushColor.r}, ${brushColor.g}, ${brushColor.b}, ${brushColor.a})`;
    brushPreviewCtx.stroke();
}
function drawBrushPreviewOnce() {
    if (!isBrushEnabled) return;
    brushPreviewCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
    brushPreviewCtx.beginPath();
    brushPreviewCtx.arc(lastMouseX, lastMouseY, (brushPreviewCtx.lineWidth / (2 * magic_value)), 0, 2 * Math.PI);
    brushPreviewCtx.strokeStyle = `rgba(${brushColor.r}, ${brushColor.g}, ${brushColor.b}, ${brushColor.a})`;
    brushPreviewCtx.stroke();
}

// Function to undo the last drawing
function undoBrush() {
    // if (undoStack.length === 0) return;
    // const lastState = undoStack.pop();
    // imageCtx.putImageData(lastState, 0, 0);
    if (AllStrokes.length > 0) {
        AllStrokes.pop();
    }
    // sendStrokeDataToServer(AllStrokes);
}

function clearBrush() {
    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    AllStrokes = [];
    // sendStrokeDataToServer(AllStrokes);
}

// const scriptExports = {
//     clearBrush,
//     updateCanvasSize,
// };
  
// export default scriptExports;