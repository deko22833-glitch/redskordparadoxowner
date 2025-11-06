let isLoginMode = true;

// API base URL - использует переменную окружения или относительный путь
const API_BASE_URL = window.API_BASE_URL || '';

document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
});

function initializeAuth() {
    const authForm = document.getElementById('authForm');
    const switchLink = document.getElementById('switchLink');
    
    // Check if already logged in (only check, don't redirect immediately)
    const token = localStorage.getItem('token');
    const currentUser = localStorage.getItem('currentUser');
    
    // Only redirect if we have both token and user data
    if (token && currentUser) {
        // Verify token is not expired by attempting to parse user data
        try {
            JSON.parse(currentUser);
            // Small delay to avoid redirect loops
            setTimeout(() => {
                window.location.replace('index.html');
            }, 100);
            return;
        } catch (e) {
            // Invalid user data, clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
        }
    }
    
    authForm.addEventListener('submit', handleSubmit);
    switchLink.addEventListener('click', toggleMode);
}

function toggleMode(e) {
    e.preventDefault();
    
    isLoginMode = !isLoginMode;
    
    const usernameGroup = document.getElementById('usernameGroup');
    const usernameLoginGroup = document.getElementById('usernameLoginGroup');
    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
    const submitBtn = document.getElementById('submitBtn');
    const switchText = document.getElementById('switchText');
    const switchLink = document.getElementById('switchLink');
    
    // Очистка полей при переключении
    document.getElementById('username').value = '';
    document.getElementById('usernameLogin').value = '';
    document.getElementById('password').value = '';
    document.getElementById('confirmPassword').value = '';
    
    if (isLoginMode) {
        usernameGroup.style.display = 'none';
        usernameLoginGroup.style.display = 'block';
        confirmPasswordGroup.style.display = 'none';
        document.getElementById('username').removeAttribute('required');
        document.getElementById('confirmPassword').removeAttribute('required');
        document.getElementById('usernameLogin').setAttribute('required', 'required');
        submitBtn.textContent = 'Log In';
        switchText.textContent = 'Need an account?';
        switchLink.textContent = 'Register';
        document.querySelector('.logo h1').textContent = 'Welcome back!';
        document.querySelector('.logo p').textContent = "We're so excited to see you again!";
    } else {
        usernameGroup.style.display = 'block';
        usernameLoginGroup.style.display = 'none';
        confirmPasswordGroup.style.display = 'block';
        document.getElementById('usernameLogin').removeAttribute('required');
        document.getElementById('username').setAttribute('required', 'required');
        document.getElementById('confirmPassword').setAttribute('required', 'required');
        submitBtn.textContent = 'Register';
        switchText.textContent = 'Already have an account?';
        switchLink.textContent = 'Log In';
        document.querySelector('.logo h1').textContent = 'Create an account';
        document.querySelector('.logo p').textContent = 'Welcome to Discord Clone!';
    }
    
    // Clear any error messages
    removeMessage('error-message');
    removeMessage('success-message');
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const username = isLoginMode 
        ? document.getElementById('usernameLogin').value 
        : document.getElementById('username').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validation
    if (!username || username.trim().length < 3) {
        showError('Username must be at least 3 characters long');
        return;
    }
    
    if (!isLoginMode) {
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }
    }
    
    if (!password || password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }
    
    if (isLoginMode) {
        await login(username, password);
    } else {
        await register(username, password);
    }
}

async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
            showError(errorData.error || 'Login failed');
            return;
        }
        
        const data = await response.json();
        
        // Save token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        showSuccess('Login successful! Redirecting...');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please check your connection and try again.');
    }
}

async function register(username, password) {
    try {
        console.log('Attempting registration with username:', username);
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        console.log('Registration response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
            console.error('Registration error:', errorData);
            showError(errorData.error || 'Registration failed');
            return;
        }
        
        const data = await response.json();
        console.log('Registration successful:', data);
        
        // Save token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        showSuccess('Registration successful! Redirecting...');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
    } catch (error) {
        console.error('Registration error:', error);
        showError('Network error. Please check your connection and try again. Make sure the backend server is running.');
    }
}

function showError(message) {
    removeMessage('error-message');
    removeMessage('success-message');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message show';
    errorDiv.textContent = message;
    
    const form = document.getElementById('authForm');
    form.insertBefore(errorDiv, form.firstChild);
}

function showSuccess(message) {
    removeMessage('error-message');
    removeMessage('success-message');
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message show';
    successDiv.textContent = message;
    
    const form = document.getElementById('authForm');
    form.insertBefore(successDiv, form.firstChild);
}

function removeMessage(className) {
    const existingMessage = document.querySelector('.' + className);
    if (existingMessage) {
        existingMessage.remove();
    }
}