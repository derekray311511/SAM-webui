
document.getElementById('blurSlider').addEventListener('input', function() {
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
});
