// Add this to the beginning of your script
const imageCanvas = document.getElementById('image-canvas');
const imageCtx = imageCanvas.getContext('2d');
const baseLineWidth = 5;
const maxUndoStackSize = 100; // Set the maximum number of elements for the undo stack
const undoStack = [];
let currentStroke = [];

// Variables for the brush tool
let isBrushEnabled = false;
let isDrawing = false;

// Function to enable the brush tool
function enableBrush() {
    isBrushEnabled = true;
    imageCanvas.style.pointerEvents = 'auto';
    imageCtx.strokeStyle = 'black'; // Change this to the color you want for the brush
    imageCtx.lineWidth = baseLineWidth; // Change this to the brush width you want
    imageCtx.lineJoin = 'round';
    imageCtx.lineCap = 'round';
}

// Function to disable the brush tool
function disableBrush() {
    isBrushEnabled = false;
    imageCanvas.style.pointerEvents = 'none';
}

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
    if (!isBrushEnabled) return;
    isDrawing = true;
    // Check if the undo stack has reached the maximum size
    if (undoStack.length >= maxUndoStackSize) {
        // Remove the oldest canvas state from the stack
        undoStack.shift();
    }
    // Save the current canvas state before starting a new drawing
    undoStack.push(imageCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height));
    const mousePos = getMousePos(imageCanvas, e);
    imageCtx.beginPath();
    imageCtx.moveTo(mousePos.x, mousePos.y);
}

// Function to draw
function draw(e) {
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
    sendStrokeDataToServer(currentStroke);
    currentStroke = []; // Reset the current stroke
}

// Function to send stroke data to the server
function sendStrokeDataToServer(strokeData) {
    // Send the stroke data to the server
    $.ajax({
        url: "/send_stroke_data",
        type: "POST",
        data: JSON.stringify({ stroke_data: strokeData }),
        contentType: "application/json",
        success: function (response) {
            // Handle the server response here
            console.log(response);
        },
        error: function (error) {
            console.error(error);
        }
    });
}


// Add event listeners for the brush tool
imageCanvas.addEventListener('mousedown', startDrawing);
imageCanvas.addEventListener('mousemove', draw);
imageCanvas.addEventListener('mouseup', stopDrawing);
// imageCanvas.addEventListener('mouseout', stopDrawing);

// Update the canvas size after loading the image
function updateCanvasSize() {
    // Save the current canvas content
    const currentCanvasContent = imageCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);

    // Update the canvas size
    imageCanvas.width = $('#preview').width();
    imageCanvas.height = $('#preview').height();
    imageCtx.lineWidth = baseLineWidth;

    // Draw the saved content back onto the canvas
    imageCtx.putImageData(currentCanvasContent, 0, 0);
}

// Function to undo the last drawing
function undoBrush() {
    if (undoStack.length === 0) return;
    const lastState = undoStack.pop();
    imageCtx.putImageData(lastState, 0, 0);
    sendStrokeDataToServer(currentStroke);
}

function clearBrush() {
    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    sendStrokeDataToServer([]);
}