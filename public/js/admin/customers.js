  // Search functionality
  document.getElementById('searchInput').addEventListener('keyup', function() {
   const searchValue = this.value.toLowerCase();
   const rows = document.querySelectorAll('#customerTableBody tr');
   
   rows.forEach(row => {
       const text = row.textContent.toLowerCase();
       row.style.display = text.includes(searchValue) ? '' : 'none';
   });
});

// Block/Unblock functionality
// function toggleBlock(button, customerId) {
//    const row = button.closest('tr');
//    const isBlocked = button.textContent === 'Unblock';
   
//    if (isBlocked) {
//        button.textContent = 'Block';
//        button.classList.remove('btn-success');
//        button.classList.add('btn-danger');
//        row.classList.remove('blocked');
//    } else {
//        button.textContent = 'Unblock';
//        button.classList.remove('btn-danger');
//        button.classList.add('btn-success');
//        row.classList.add('blocked');
//    }

//    // Here you would typically make an API call to update the customer's status
//    console.log(`Customer ${customerId} ${isBlocked ? 'unblocked' : 'blocked'}`);
// }