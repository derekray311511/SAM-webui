const blurSlider = document.getElementById('blurSlider');

function sendBlurLevel() {
    var blurLevel = document.getElementById('blurSlider').value;
    $.ajax({
        url: '/apply_blur',  // Replace with your server's URL
        type: 'POST',
        data: { 'blurLevel': blurLevel },
        success: function (response) {
            const image = new Image();
            image.src = "data:image/jpeg;base64," + response.image;
            image.onload = function () {
                const canvasWidth = $('#preview').width();
                const canvasHeight = $('#preview').height();
                $("#preview").attr("src", image.src);
                $('#zoom-image').attr('src', image.src);
            };
        },
        error: function(error) {
            console.log(error);
        }
    });
}

document.getElementById('blurSlider').addEventListener('input', function() {
    sendBlurLevel();
});

blurSlider.addEventListener('wheel', function(event) {
    var isFocused = (document.activeElement === blurSlider);
    if (!isFocused) {
        return;
    }
    event.preventDefault();  // Prevents the default scroll behavior
    if (event.deltaY < 0) {
        // If the mouse wheel is scrolled up, increase the value of the slider
        blurSlider.stepUp();
    } else {
        // If the mouse wheel is scrolled down, decrease the value of the slider
        blurSlider.stepDown();
    }
    sendBlurLevel();
});
