document.addEventListener('DOMContentLoaded', () => {
    // Get UI elements
    const cashierNameEl = document.getElementById('cashierName');
    const processedCountEl = document.getElementById('processedCount');
    const scanButton = document.getElementById('scanButton');
    const qrScannerContainer = document.getElementById('qrScannerContainer');
    const qrScanner = document.getElementById('qrScanner');
    const closeScanner = document.getElementById('closeScanner');
    const voucherCodeInput = document.getElementById('voucherCode');
    const validateBtn = document.getElementById('validateBtn');
    const statusPill = document.getElementById('statusPill');
    const statusText = document.getElementById('statusText');
    const validIcon = document.getElementById('validIcon');
    const finishBtn = document.getElementById('finishBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Variables
    let html5QrCode = null;
    let currentCode = null;
    let isValidCode = false;
    let processedCount = 0;

    // Check authentication on load
    checkAuth();

    // Set up event listeners
    scanButton.addEventListener('click', startScanner);
    closeScanner.addEventListener('click', stopScanner);
    validateBtn.addEventListener('click', validateCode);
    finishBtn.addEventListener('click', redeemVoucher);
    cancelBtn.addEventListener('click', resetForm);
    // Press Enter in code box = validate
    voucherCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            validateCode();
        }
    });
    logoutBtn.addEventListener('click', logout);
    resetBtn.addEventListener('click', onReset);
    voucherCodeInput.addEventListener('input', () => {
        // Reset validation state when input changes
        resetValidationState();
    });

    // Check authentication status
    async function checkAuth() {
        try {
            const response = await fetch('/api/me');
            
            if (response.status === 401) {
                // Not authenticated, redirect to login
                window.location.href = 'index.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.ok) {
                // Update UI with user info
                cashierNameEl.textContent = data.cashierId;
                processedCount = data.processedCount || 0;
                processedCountEl.textContent = processedCount;
            } else {
                // Error, redirect to login
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Auth check error:', error);
            // Redirect to login on error
            window.location.href = 'index.html';
        }
    }

    // Start QR scanner
    function startScanner() {
        qrScannerContainer.style.display = 'block';
        scanButton.disabled = true;
        
        html5QrCode = new Html5Qrcode(qrScanner.id);
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        ).catch(err => {
            console.error('Camera start error:', err);
            showError('Camera access failed. Use manual entry or try HTTPS/localhost');
            qrScannerContainer.style.display = 'none';
            scanButton.disabled = false;
        });
    }
    
    // Stop QR scanner
    function stopScanner() {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop()
                .then(() => {
                    // ensure camera stream is released
                    if (typeof html5QrCode.clear === 'function') {
                        html5QrCode.clear();
                    }
                    qrScannerContainer.style.display = 'none';
                    scanButton.disabled = false;
                    voucherCodeInput.focus();
                })
                .catch(err => {
                    console.error('Error stopping scanner:', err);
                    qrScannerContainer.style.display = 'none';
                    scanButton.disabled = false;
                    voucherCodeInput.focus();
                });
        } else {
            qrScannerContainer.style.display = 'none';
            scanButton.disabled = false;
            voucherCodeInput.focus();
        }
    }
    
    // Handle successful QR scan
    function onScanSuccess(decodedText) {
        // Trim & limit length to avoid noisy scans
        const cleaned = decodedText.trim().slice(0, 64);
        // Fill the voucher code input
        voucherCodeInput.value = cleaned;
        
        // Stop the scanner
        stopScanner();
        
        // Validate the code automatically
        validateCode();

        // Feedback beep (non-blocking)
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 880;
            osc.connect(ctx.destination);
            osc.start();
            setTimeout(() => {
                osc.stop();
                ctx.close();
            }, 120);
        } catch (_) { /* ignore audio errors */ }
    }
    
    // Handle QR scan failure
    function onScanFailure(error) {
        // Just log the error, don't show to user unless persistent
        console.log('QR scan error:', error);
    }

    // Validate voucher code
    async function validateCode() {
        const code = voucherCodeInput.value.trim();
        
        if (!code) {
            showError('Please enter a voucher code');
            return;
        }
        
        // Reset previous validation
        resetValidationState();
        
        // Disable buttons during validation
        setLoading(true);
        
        try {
            const response = await fetch('/api/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code })
            });
            
            const data = await response.json();
            
            if (response.ok && data.ok) {
                if (data.valid) {
                    // Valid code
                    showValidStatus(true, 'Valid Voucher');
                    currentCode = code;
                    isValidCode = true;
                    finishBtn.disabled = false;
                } else {
                    // Invalid code
                    let reason = data.reason || 'Invalid voucher';
                    if (data.status === 'redeemed') {
                        reason = 'Already redeemed';
                    }
                    showValidStatus(false, reason);
                    currentCode = null;
                    isValidCode = false;
                }
            } else {
                // API error
                showError(data.error || 'Validation failed');
            }
        } catch (error) {
            console.error('Validation error:', error);
            showError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    // Redeem voucher
    async function redeemVoucher() {
        if (!isValidCode || !currentCode) {
            showError('Please validate a voucher code first');
            return;
        }
        
        // Disable buttons during redemption
        setLoading(true);
        
        try {
            const response = await fetch('/api/redeem', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: currentCode })
            });
            
            const data = await response.json();
            
            if (response.ok && data.ok && data.redeemed) {
                // Successfully redeemed
                processedCount++;
                processedCountEl.textContent = processedCount;
                
                // Show success briefly
                showValidStatus(true, 'Redemption successful!');
                
                // Reset form after a brief delay
                setTimeout(() => {
                    resetForm();
                }, 1500);
            } else {
                // Redemption failed
                showValidStatus(false, data.reason || 'Redemption failed');
            }
        } catch (error) {
            console.error('Redemption error:', error);
            showError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    // Reset form
    function resetForm() {
        voucherCodeInput.value = '';
        statusPill.style.display = 'none';
        finishBtn.disabled = true;
        currentCode = null;
        isValidCode = false;
    }

    // Reset validation state
    function resetValidationState() {
        statusPill.style.display = 'none';
        finishBtn.disabled = true;
        isValidCode = false;
    }

    // Show valid/invalid status
    function showValidStatus(isValid, message) {
        statusPill.className = isValid ? 'status-pill valid' : 'status-pill invalid';
        statusText.textContent = message;
        
        // Ensure we have an SVG icon element to update
        let icon = document.getElementById('validIcon');
        if (!icon) {
            icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('id', 'validIcon');
            icon.setAttribute('width', '20');
            icon.setAttribute('height', '20');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('fill', 'none');
            icon.setAttribute('stroke', 'currentColor');
            icon.setAttribute('stroke-width', '2');
            icon.setAttribute('stroke-linecap', 'round');
            icon.setAttribute('stroke-linejoin', 'round');
            // place icon before the text for proper layout
            statusPill.insertBefore(icon, statusText);
        }

        // Update icon graphic (checkmark for valid, X for invalid)
        if (isValid) {
            icon.innerHTML = `
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            `;
        } else {
            icon.innerHTML = `
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            `;
        }
        
        statusPill.style.display = 'flex';
    }

    // Show error message
    function showError(message) {
        showValidStatus(false, message);
    }

    // Set loading state
    function setLoading(isLoading) {
        validateBtn.disabled = isLoading;
        finishBtn.disabled = isLoading || !isValidCode;
        cancelBtn.disabled = isLoading;
        scanButton.disabled = isLoading || qrScannerContainer.style.display !== 'none';
        
        validateBtn.textContent = isLoading ? 'Validating...' : 'Validate Code';
        finishBtn.textContent = isLoading ? 'Processing...' : 'Finish';
    }

    // Logout
    async function logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            // Redirect to login page
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            // Redirect anyway
            window.location.href = 'index.html';
        }
    }

    // Reset stats & redemptions
    async function onReset() {
        if (!confirm('Reset all counters and redemptions? This cannot be undone.')) {
            return;
        }
        setLoading(true);
        try {
            const resp = await fetch('/api/reset', { method: 'POST' });
            const data = await resp.json();
            if (resp.ok && data.ok) {
                // Reset local state
                processedCount = 0;
                processedCountEl.textContent = '0';
                resetForm();
                showValidStatus(true, 'All data reset');
            } else {
                showError('Reset failed');
            }
        } catch (err) {
            console.error('Reset error:', err);
            showError('Reset failed');
        } finally {
            setLoading(false);
        }
    }
});
