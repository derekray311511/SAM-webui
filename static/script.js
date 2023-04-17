let switch_view = 0;
let switch_pn_point = 1;

document.addEventListener('keydown', function(event) {
    if (event.key === '1') {
        buttonClick('image');
        switch_view = 0;
    } 
    else if (event.key === '2') {
        buttonClick('maskImage');
        switch_view = 1;
    }
    else if (event.key === '3') {
        buttonClick('colorMasks');
        switch_view = 2;
    }
    else if (event.key === 'v') {
        if (switch_view === 0) {
            buttonClick('maskImage');
        }
        else if (switch_view === 1) {
            buttonClick('colorMasks');
        }
        else if (switch_view === 2) {
            buttonClick('image')
        }
        switch_view = (switch_view + 1) % 3;
    }
    else if (event.key === "c" && !event.ctrlKey) {
        buttonClick('clear');
    }
    else if (event.key === '4') {
        buttonClick('button4');
    }
    else if (event.key === '5') {
        buttonClick('button5');
    }
    else if (event.key === '6' || event.key === "b") {
        buttonClick('button6');
    }
    else if (event.key === '7' || event.key === "r") {
        buttonClick('inference');
    }
    else if (event.key === '8') {
        buttonClick('undo');
    }
    else if (event.key === 'ArrowLeft') {
        buttonClick('prev-image');
    }
    else if (event.key === 'ArrowRight') {
        buttonClick('next-image');
    }
    else if (event.key === 'p') {
        if (switch_pn_point === 0) {
            buttonClick('button4');
        }
        else if (switch_pn_point === 1) {
            buttonClick('button5');
        }
        switch_pn_point ^= 1;
    }
});

function buttonClick(buttonId) {
    const button = document.getElementById(buttonId);
    button.click();
}

document.getElementById('image').addEventListener('click', function() {
    console.log('Button image clicked');
});

document.getElementById('maskImage').addEventListener('click', function() {
    console.log('Button maskImage clicked');
});

document.getElementById('colorMasks').addEventListener('click', function() {
    console.log('Button colorMasks clicked');
});

document.getElementById('clear').addEventListener('click', function() {
    console.log('Button clear clicked');
});

document.getElementById('button4').addEventListener('click', function() {
    console.log('Button 4 clicked');
});

document.getElementById('button5').addEventListener('click', function() {
    console.log('Button 5 clicked');
});

document.getElementById('button6').addEventListener('click', function() {
    console.log('Button 6 clicked');
});

document.getElementById('inference').addEventListener('click', function() {
    console.log('Button inference clicked');
});

document.getElementById('undo').addEventListener('click', function() {
    console.log('Button 8 clicked');
});

document.getElementById('prev-image').addEventListener('click', function() {
    console.log('Button prev-image clicked');
});

document.getElementById('next-image').addEventListener('click', function() {
    console.log('Button next-image clicked');
});

// ctrl Shortcuts
$(document).keydown(function (event) {
    // Check if the Ctrl key is pressed and the key code for the 's' key (83)
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault(); // Prevent the browser's default save action
        buttonClick('save-masks'); // Call the function to save the image
    }
});
$(document).keydown(function (event) {
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault(); // Prevent the browser's default save action
        buttonClick('load-image'); // Call the function to save the image
    }
});
$(document).keydown(function (event) {
    if (event.ctrlKey && event.key === 'z') {
        event.preventDefault(); // Prevent the browser's default save action
        buttonClick('undo'); // Call the function to save the image
    }
});
$(document).keydown(function (event) {
    if (event.key === 'z' && !event.ctrlKey) {
        event.preventDefault(); // Prevent the browser's default save action
        buttonClick('toggle-zoom'); // Call the function to save the image
    }
});

// Mouse wheel event

// For #Thumbnail-container
function handleMouseWheelScroll(e) {
    const thumbnailContainer = document.getElementById("thumbnail-container");
    e.preventDefault();
    // Scroll horizontally based on the wheelDeltaY value
    thumbnailContainer.scrollLeft += e.deltaY * 2;
}
document.getElementById("thumbnail-container").addEventListener("wheel", handleMouseWheelScroll);

// For preview zoom in / zoom out
function handleMouseWheel(e) {
    e.preventDefault();
    const scaleFactor = 0.1;
    const preview = document.getElementById("preview");
    const container = document.getElementById("image-container");

    // Calculate the new width and height
    let newWidth = preview.clientWidth + (e.deltaY < 0 ? 2 : -1) * scaleFactor * preview.clientWidth;
    let newHeight = preview.clientHeight + (e.deltaY < 0 ? 2 : -1) * scaleFactor * preview.clientHeight;

    if (newWidth < container.clientWidth || newHeight < container.clientHeight) {
        newWidth = container.clientWidth;
        newHeight = container.clientHeight;
    }

    // Maintain the aspect ratio
    const aspectRatio = preview.naturalWidth / preview.naturalHeight;
    newHeight = newWidth / aspectRatio;

    // Update the preview size
    preview.style.width = `${newWidth - 4}px`;
    preview.style.height = `${newHeight - 4}px`;

    // Calculate the mouse position relative to the container
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate the scroll position before resizing
    const scrollXBefore = container.scrollLeft + mouseX;
    const scrollYBefore = container.scrollTop + mouseY;

    // Calculate the new scroll position based on the mouse position
    const scrollXAfter = scrollXBefore * (newWidth / (newWidth - (e.deltaY < 0 ? 2 : -1) * scaleFactor * preview.clientWidth));
    const scrollYAfter = scrollYBefore * (newHeight / (newHeight - (e.deltaY < 0 ? 2 : -1) * scaleFactor * preview.clientHeight));

    // Adjust the container scroll position
    container.scrollLeft = scrollXAfter - mouseX;
    container.scrollTop = scrollYAfter - mouseY;
    updatePointsAndBoxes();
}
document.getElementById("image-container").addEventListener("wheel", handleMouseWheel);

// For dragging image to move in the image-container
let ctrlPressed = false;
let dragging = false;
let prevMouseX;
let prevMouseY;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Control') {
        ctrlPressed = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Control') {
        ctrlPressed = false;
    }
});

const container = document.getElementById("image-container");
container.addEventListener('mousedown', (e) => {
    if (ctrlPressed) {
        dragging = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        e.preventDefault(); // Prevent other mouse events
    }
});

container.addEventListener('mousemove', (e) => {
    if (dragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        container.scrollLeft -= deltaX;
        container.scrollTop -= deltaY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        e.preventDefault(); // Prevent other mouse events
    }
});

container.addEventListener('mouseup', (e) => {
    if (ctrlPressed) {
        dragging = false;
        e.preventDefault(); // Prevent other mouse events
    }
});

// For the dragging icon
let isCtrlPressed = false;

$(document).keydown(function(e) {
    if (e.which === 17) { // 17 is the keyCode for the ctrl key
        isCtrlPressed = true;
        $("#preview").css("cursor", "grab");
    }
});

$(document).keyup(function(e) {
    if (e.which === 17) {
        isCtrlPressed = false;
        $("#preview").css("cursor", "crosshair");
    }
});

function getScalingFactor(originalWidth, originalHeight, currentWidth, currentHeight) {
    return {
        x: currentWidth / originalWidth,
        y: currentHeight / originalHeight
    };
}

function updatePointsAndBoxes() {
    const originalWidth = $('#preview').data('originalWidth');
    const originalHeight = $('#preview').data('originalHeight');
    const currentWidth = $('#preview').width();
    const currentHeight = $('#preview').height();

    const scalingFactor = getScalingFactor(originalWidth, originalHeight, currentWidth, currentHeight);

    points.forEach(point => {
        point.style.left = parseFloat(point.dataset.originalX) * scalingFactor.x - 4 + 'px';
        point.style.top = parseFloat(point.dataset.originalY) * scalingFactor.y - 4 + 'px';
    });

    boxes.forEach(box => {
        box.style.left = parseFloat(box.dataset.originalX1) * scalingFactor.x + 'px';
        box.style.top = parseFloat(box.dataset.originalY1) * scalingFactor.y + 'px';
        box.style.width = (parseFloat(box.dataset.originalX2) - parseFloat(box.dataset.originalX1)) * scalingFactor.x + 'px';
        box.style.height = (parseFloat(box.dataset.originalY2) - parseFloat(box.dataset.originalY1)) * scalingFactor.y + 'px';
    });
}

function togglePointsAndBoxesVisibility(enable) {
    const imageContainer = document.getElementById("image-container");
    const pointsAndBoxes = imageContainer.querySelectorAll(".point, .box");

    pointsAndBoxes.forEach(element => {
        const $element = $(element); // Wrap the element with jQuery
        const currentDisplayStyle = $element.css("display");

        if (enable) {
            // Retrieve the original display style from the data attribute
            const originalDisplayStyle = $element.data("original-display-style");
            if (originalDisplayStyle) {
                // Set the original display style back to the element
                $element.css("display", originalDisplayStyle);
                $element.removeData("original-display-style");
            }
        } 
        else {
            if (!$element.data("original-display-style")) {
                // Store the current display style in a data attribute
                $element.data("original-display-style", currentDisplayStyle);
                $element.css("display", "none");
            }
        }
    });
}

function clear_original_display_style() {
    const imageContainer = document.getElementById("image-container");
    const pointsAndBoxes = imageContainer.querySelectorAll(".point, .box");
    pointsAndBoxes.forEach(element => {
        const $element = $(element); // Wrap the element with jQuery
        $element.removeData("original-display-style");
    });
}


function toggleProcessingButtons(disabled) {
    $("button").prop("disabled", disabled);
    if (disabled) {
        $("button").addClass("processing");
    } else {
        $("button").removeClass("processing");
    }
}

function toggleSelectedViewButton(buttonId) {
    // Remove the 'selected-view' class from all view buttons
    $("#image, #maskImage, #colorMasks").removeClass("selected-view");
    // Add the 'selected-view' class to the clicked view button
    $(`#${buttonId}`).addClass("selected-view");
}

function toggleSelectedModeButton(buttonId) {
    // Remove the 'selected-Mode' class from all Mode buttons
    $("#button4, #button5, #button6").removeClass("selected-view");
    // Add the 'selected-Mode' class to the clicked Mode button
    $(`#${buttonId}`).addClass("selected-view");
}

function toggleZoomButton(zoomEnabled) {
    if (zoomEnabled) {
        $("#toggle-zoom").addClass("selected-view");
    }
    else {
        $("#toggle-zoom").removeClass("selected-view");
    }
}
