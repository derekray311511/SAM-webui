// Get the required elements
const selectedOption = document.getElementById('save-type');
const optionsContainer = document.getElementById('options-container');
optionsContainer.dataset.value = "colorMasks";
const options = optionsContainer.querySelectorAll('.option');

// // Add a click event listener to the selected option to toggle the options container
// selectedOption.addEventListener('click', () => {
//     optionsContainer.style.display = optionsContainer.style.display === 'block' ? 'none' : 'block';
// });

// Add a click event listener to the selected option to toggle the options container
// Close dropdown menu on click
window.onclick = function(e) {
    console.log(e.target);
    if (e.target.matches(".selected-option")) {
        console.log("You clicked the options-container dropdown menu");
        optionsContainer.style.display = optionsContainer.style.display === 'block' ? 'none' : 'block';
        e.preventDefault(); // Prevents propagation
    } else {
        console.log("You clicked somewhere else");
        optionsContainer.style.display = "none";
    }
}

// Add a click event listener to each option
options.forEach(option => {
    option.addEventListener('click', () => {
        // Update the selected option's text and close the options container
        selectedOption.textContent = option.textContent;
        optionsContainer.style.display = 'none';

        // Get the selected value and do something with it
        const selectedValue = option.dataset.value;
        optionsContainer.dataset.value = selectedValue;
        
        console.log('optionsContainer val:', optionsContainer.dataset.value)
    });
});

document.querySelectorAll('.option').forEach(option => {
    option.addEventListener('click', function() {
        // Remove the .option-selected class from any previously selected options
        document.querySelectorAll('.option-selected').forEach(selectedOption => {
            selectedOption.classList.remove('option-selected');
        });

        // Add the .option-selected class to the clicked option
        this.classList.add('option-selected');
    });
});
