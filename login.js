document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginMsg = document.getElementById('loginMsg');
    const cashierIdInput = document.getElementById('cashierId');
    const pinInput = document.getElementById('pin');
    const signInBtn = document.getElementById('signInBtn');

    // Check if user is already logged in
    checkAuthStatus();

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous messages
        loginMsg.textContent = '';
        loginMsg.className = 'message';
        
        // Get form values
        const cashierId = cashierIdInput.value.trim();
        const pin = pinInput.value.trim();
        
        // Validate inputs
        if (!cashierId || !pin) {
            showError('Please enter both Cashier ID and PIN');
            return;
        }
        
        // Disable button during login
        setLoading(true);
        
        try {
            // Send login request
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cashierId, pin })
            });
            
            const data = await response.json();
            
            if (response.ok && data.ok) {
                // Login successful
                loginMsg.textContent = 'Login successful! Redirecting...';
                loginMsg.className = 'message success';
                
                // Store session info in sessionStorage if needed
                sessionStorage.setItem('cashierId', data.cashierId);
                sessionStorage.setItem('processedCount', data.processedCount || 0);
                
                // Redirect to portal page
                setTimeout(() => {
                    window.location.href = 'portal.html';
                }, 500);
            } else {
                // Login failed
                showError(data.error || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    });
    
    // Helper function to show error message
    function showError(message) {
        loginMsg.textContent = message;
        loginMsg.className = 'message error';
        pinInput.value = ''; // Clear password field for security
    }
    
    // Helper function to set loading state
    function setLoading(isLoading) {
        signInBtn.disabled = isLoading;
        signInBtn.textContent = isLoading ? 'Signing in...' : 'Sign In';
    }
    
    // Check if user is already authenticated
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/me');
            const data = await response.json();
            
            if (response.ok && data.ok) {
                // User is already logged in, redirect to portal
                window.location.href = 'portal.html';
            }
        } catch (error) {
            // Ignore errors during auth check
            console.log('Not logged in yet');
        }
    }
});
