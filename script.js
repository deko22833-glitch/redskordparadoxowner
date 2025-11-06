// Global variables
let socket;
let currentUser = null;
let currentChannel = 'general';
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let isInCall = false;
let isMuted = false;
let isVideoEnabled = true;
let isScreenSharing = false;

// WebRTC configuration
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initializeApp();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('currentUser');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        updateUserInfo();
    } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.username;
        document.getElementById('userAvatar').textContent = currentUser.avatar || currentUser.username.charAt(0).toUpperCase();
    }
}

function initializeApp() {
    connectSocket();
    setupEventListeners();
    loadMessages();
    loadFriends();
    loadPendingRequests();
}

function connectSocket() {
    const token = localStorage.getItem('token');
    const API_BASE_URL = window.API_BASE_URL || '';
    
    socket = io(API_BASE_URL || window.location.origin, {
        auth: { token }
    });
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    socket.on('new-message', (data) => {
        if (data.channelId === currentChannel) {
            addMessage(data.message);
        }
    });
    
    socket.on('user-list-update', (users) => {
        updateUsersList(users);
    });
    
    socket.on('new-friend-request', () => {
        loadPendingRequests();
    });
    
    socket.on('incoming-call', (data) => {
        handleIncomingCall(data);
    });
    
    socket.on('call-accepted', (data) => {
        handleCallAccepted(data);
    });
    
    socket.on('call-rejected', (data) => {
        handleCallRejected(data);
    });
    
    socket.on('offer', async (data) => {
        await handleOffer(data);
    });
    
    socket.on('answer', async (data) => {
        await handleAnswer(data);
    });
    
    socket.on('ice-candidate', async (data) => {
        await handleIceCandidate(data);
    });
    
    socket.on('call-ended', () => {
        endCall();
    });
}

function setupEventListeners() {
    // Message form
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    
    // Channel switching
    document.querySelectorAll('.channel-item').forEach(item => {
        item.addEventListener('click', () => {
            const channel = item.dataset.channel;
            switchChannel(channel);
        });
    });
    
    // Call buttons
    document.getElementById('voiceCallBtn').addEventListener('click', () => startCall('audio'));
    document.getElementById('videoCallBtn').addEventListener('click', () => startCall('video'));
    document.getElementById('screenShareBtn').addEventListener('click', toggleScreenShare);
    
    // Call controls
    document.getElementById('endCallBtn').addEventListener('click', endCall);
    document.getElementById('hangupBtn').addEventListener('click', endCall);
    document.getElementById('muteBtn').addEventListener('click', toggleMute);
    document.getElementById('videoBtn').addEventListener('click', toggleVideo);
    
    // Friends
    document.getElementById('addFriendBtn').addEventListener('click', () => {
        document.getElementById('addFriendModal').style.display = 'flex';
        document.getElementById('searchUserInput').focus();
    });
    
    document.getElementById('closeAddFriendModal').addEventListener('click', () => {
        document.getElementById('addFriendModal').style.display = 'none';
        document.getElementById('searchUserInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    });
    
    document.getElementById('closeFriendsBtn').addEventListener('click', () => {
        document.getElementById('friendsSection').style.display = 'none';
        document.getElementById('onlineUsers').style.display = 'block';
    });
    
    // Friends tabs
    document.querySelectorAll('.friend-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchFriendsTab(tabName);
        });
    });
    
    // Search users
    let searchTimeout;
    document.getElementById('searchUserInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(() => {
            searchUsers(query);
        }, 300);
    });
    
    // Click outside modal to close
    document.getElementById('addFriendModal').addEventListener('click', (e) => {
        if (e.target.id === 'addFriendModal') {
            document.getElementById('addFriendModal').style.display = 'none';
            document.getElementById('searchUserInput').value = '';
            document.getElementById('searchResults').innerHTML = '';
        }
    });
}

function switchChannel(channel) {
    currentChannel = channel;
    
    // Update UI
    document.querySelectorAll('.channel-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-channel="${channel}"]`).classList.add('active');
    document.getElementById('currentChannel').textContent = channel;
    document.getElementById('messageInput').placeholder = `Написать сообщение в #${channel}`;
    
    // Clear messages and load new ones
    document.getElementById('messagesList').innerHTML = '';
    loadMessages();
}

function loadMessages() {
    // In a real app, you'd fetch messages from the server
    // For now, we'll just listen for new messages via socket
}

function sendMessage(e) {
    e.preventDefault();
    
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    socket.emit('send-message', {
        channelId: currentChannel,
        message: { text }
    });
    
    input.value = '';
}

function addMessage(message) {
    const messagesList = document.getElementById('messagesList');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const time = new Date(message.timestamp || Date.now()).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${message.avatar || message.author.charAt(0).toUpperCase()}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${message.author}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(message.text)}</div>
        </div>
    `;
    
    messagesList.appendChild(messageDiv);
    messagesList.scrollTop = messagesList.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// WebRTC Functions
async function startCall(type, targetUserId = null) {
    if (isInCall) {
        alert('Вы уже в звонке');
        return;
    }
    
    try {
        // Get user media
        const constraints = {
            audio: true,
            video: type === 'video' ? true : false
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Show call modal
        document.getElementById('callModal').style.display = 'flex';
        document.getElementById('localVideo').srcObject = localStream;
        
        isInCall = true;
        isVideoEnabled = type === 'video';
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        // Add local stream tracks
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    to: targetUserId || 'broadcast',
                    candidate: event.candidate
                });
            }
        };
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            document.getElementById('remoteVideo').srcObject = remoteStream;
        };
        
        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Send offer via socket
        if (targetUserId) {
            socket.emit('initiate-call', {
                to: targetUserId,
                type: type,
                from: {
                    id: currentUser.id,
                    username: currentUser.username
                }
            });
            
            socket.emit('offer', {
                to: targetUserId,
                offer: offer
            });
        } else {
            // Broadcast call
            socket.emit('initiate-call', {
                to: 'broadcast',
                type: type,
                from: {
                    id: currentUser.id,
                    username: currentUser.username
                }
            });
        }
        
        document.getElementById('callTitle').textContent = type === 'video' ? 'Видео звонок' : 'Голосовой звонок';
        
    } catch (error) {
        console.error('Error starting call:', error);
        alert('Ошибка при начале звонка: ' + error.message);
        endCall();
    }
}

async function handleIncomingCall(data) {
    const accept = confirm(`${data.from.username} звонит вам. Принять звонок?`);
    
    if (accept) {
        await acceptCall(data);
    } else {
        socket.emit('reject-call', {
            to: data.from.socketId
        });
    }
}

async function acceptCall(data) {
    try {
        // Get user media
        const constraints = {
            audio: true,
            video: data.type === 'video' ? true : false
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Show call modal
        document.getElementById('callModal').style.display = 'flex';
        document.getElementById('localVideo').srcObject = localStream;
        
        isInCall = true;
        isVideoEnabled = data.type === 'video';
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        // Add local stream tracks
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    to: data.from.socketId,
                    candidate: event.candidate
                });
            }
        };
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            document.getElementById('remoteVideo').srcObject = remoteStream;
        };
        
        // Accept call
        socket.emit('accept-call', {
            to: data.from.socketId,
            from: {
                id: currentUser.id,
                username: currentUser.username
            }
        });
        
        document.getElementById('callTitle').textContent = data.type === 'video' ? 'Видео звонок' : 'Голосовой звонок';
        
    } catch (error) {
        console.error('Error accepting call:', error);
        alert('Ошибка при принятии звонка: ' + error.message);
        endCall();
    }
}

async function handleCallAccepted(data) {
    // Call was accepted, connection will be established via offer/answer
}

function handleCallRejected(data) {
    alert('Звонок отклонен');
    endCall();
}

async function handleOffer(data) {
    if (!peerConnection) return;
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('answer', {
            to: data.from,
            answer: answer
        });
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

async function handleAnswer(data) {
    if (!peerConnection) return;
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

async function handleIceCandidate(data) {
    if (!peerConnection) return;
    
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    document.getElementById('callModal').style.display = 'none';
    document.getElementById('localVideo').srcObject = null;
    document.getElementById('remoteVideo').srcObject = null;
    
    isInCall = false;
    isScreenSharing = false;
    isMuted = false;
    isVideoEnabled = true;
}

async function toggleScreenShare() {
    if (!isInCall) {
        alert('Сначала начните звонок');
        return;
    }
    
    try {
        if (!isScreenSharing) {
            // Start screen sharing
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            
            // Replace video track
            const videoTrack = screenStream.getVideoTracks()[0];
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }
            
            // Update local video
            document.getElementById('localVideo').srcObject = screenStream;
            
            // Handle screen share end
            videoTrack.onended = () => {
                toggleScreenShare();
            };
            
            isScreenSharing = true;
        } else {
            // Stop screen sharing
            const userMedia = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const videoTrack = userMedia.getVideoTracks()[0];
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }
            
            document.getElementById('localVideo').srcObject = userMedia;
            localStream = userMedia;
            isScreenSharing = false;
        }
    } catch (error) {
        console.error('Error toggling screen share:', error);
        alert('Ошибка при переключении экрана: ' + error.message);
    }
}

function toggleMute() {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach(track => {
        track.enabled = isMuted;
    });
    
    isMuted = !isMuted;
    
    // Update button UI
    const muteBtn = document.getElementById('muteBtn');
    if (isMuted) {
        muteBtn.style.background = '#f04747';
    } else {
        muteBtn.style.background = '#36393f';
    }
}

function toggleVideo() {
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach(track => {
        track.enabled = isVideoEnabled;
    });
    
    isVideoEnabled = !isVideoEnabled;
    
    // Update button UI
    const videoBtn = document.getElementById('videoBtn');
    if (!isVideoEnabled) {
        videoBtn.style.background = '#f04747';
    } else {
        videoBtn.style.background = '#36393f';
    }
}

// Friends Functions
async function loadFriends() {
    try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = window.API_BASE_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/friends`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const friends = await response.json();
            displayFriends(friends);
        }
    } catch (error) {
        console.error('Error loading friends:', error);
    }
}

async function loadPendingRequests() {
    try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = window.API_BASE_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/friends/pending`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const requests = await response.json();
            displayPendingRequests(requests);
            
            // Show friends section if there are pending requests
            if (requests.length > 0) {
                document.getElementById('friendsSection').style.display = 'block';
                document.getElementById('onlineUsers').style.display = 'none';
                switchFriendsTab('pending');
            }
        }
    } catch (error) {
        console.error('Error loading pending requests:', error);
    }
}

function displayFriends(friends) {
    const friendsList = document.getElementById('friendsList');
    
    if (friends.length === 0) {
        friendsList.innerHTML = '<div class="empty-state">У вас пока нет друзей</div>';
        return;
    }
    
    friendsList.innerHTML = '';
    
    friends.forEach(friend => {
        const friendDiv = document.createElement('div');
        friendDiv.className = 'friend-item';
        friendDiv.innerHTML = `
            <div class="friend-avatar">${friend.avatar || friend.username.charAt(0).toUpperCase()}</div>
            <div class="friend-info">
                <div class="friend-name">${friend.username}</div>
                <div class="friend-status ${friend.status?.toLowerCase() || 'offline'}">${friend.status || 'Offline'}</div>
            </div>
            <div class="friend-actions">
                <button class="friend-action-btn" onclick="startCall('video', ${friend.id})" title="Видео звонок">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                </button>
                <button class="friend-action-btn remove" onclick="removeFriend(${friend.id})" title="Удалить друга">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        `;
        friendsList.appendChild(friendDiv);
    });
}

function displayPendingRequests(requests) {
    const pendingList = document.getElementById('pendingRequestsList');
    
    if (requests.length === 0) {
        pendingList.innerHTML = '<div class="empty-state">Нет входящих запросов</div>';
        return;
    }
    
    pendingList.innerHTML = '';
    
    requests.forEach(request => {
        const requestDiv = document.createElement('div');
        requestDiv.className = 'friend-request-item';
        requestDiv.innerHTML = `
            <div class="friend-avatar">${request.avatar || request.username.charAt(0).toUpperCase()}</div>
            <div class="friend-info">
                <div class="friend-name">${request.username}</div>
                <div class="friend-request-text">хочет добавить вас в друзья</div>
            </div>
            <div class="friend-request-actions">
                <button class="accept-btn" onclick="acceptFriendRequest(${request.id})">Принять</button>
                <button class="reject-btn" onclick="rejectFriendRequest(${request.id})">Отклонить</button>
            </div>
        `;
        pendingList.appendChild(requestDiv);
    });
}

async function searchUsers(query) {
    try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = window.API_BASE_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const allUsers = await response.json();
            const filtered = allUsers.filter(user => 
                user.id !== currentUser.id && 
                user.username.toLowerCase().includes(query.toLowerCase())
            );
            
            displaySearchResults(filtered);
        }
    } catch (error) {
        console.error('Error searching users:', error);
    }
}

function displaySearchResults(users) {
    const resultsDiv = document.getElementById('searchResults');
    
    if (users.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-state">Пользователи не найдены</div>';
        return;
    }
    
    resultsDiv.innerHTML = '';
    
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'search-result-item';
        userDiv.innerHTML = `
            <div class="friend-avatar">${user.avatar || user.username.charAt(0).toUpperCase()}</div>
            <div class="friend-info">
                <div class="friend-name">${user.username}</div>
                <div class="friend-status ${user.status?.toLowerCase() || 'offline'}">${user.status || 'Offline'}</div>
            </div>
            <button class="add-friend-request-btn" onclick="sendFriendRequest(${user.id})">Добавить</button>
        `;
        resultsDiv.appendChild(userDiv);
    });
}

async function sendFriendRequest(friendId) {
    try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = window.API_BASE_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/friends/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ friendId })
        });
        
        if (response.ok) {
            alert('Запрос на добавление в друзья отправлен');
            document.getElementById('searchUserInput').value = '';
            document.getElementById('searchResults').innerHTML = '';
        } else {
            const error = await response.json();
            alert(error.error || 'Ошибка при отправке запроса');
        }
    } catch (error) {
        console.error('Error sending friend request:', error);
        alert('Ошибка при отправке запроса');
    }
}

async function acceptFriendRequest(friendId) {
    try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = window.API_BASE_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/friends/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ friendId })
        });
        
        if (response.ok) {
            loadFriends();
            loadPendingRequests();
        } else {
            alert('Ошибка при принятии запроса');
        }
    } catch (error) {
        console.error('Error accepting friend request:', error);
        alert('Ошибка при принятии запроса');
    }
}

async function rejectFriendRequest(friendId) {
    try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = window.API_BASE_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/friends/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ friendId })
        });
        
        if (response.ok) {
            loadPendingRequests();
        } else {
            alert('Ошибка при отклонении запроса');
        }
    } catch (error) {
        console.error('Error rejecting friend request:', error);
        alert('Ошибка при отклонении запроса');
    }
}

async function removeFriend(friendId) {
    if (!confirm('Удалить этого пользователя из друзей?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = window.API_BASE_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/friends/${friendId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            loadFriends();
        } else {
            alert('Ошибка при удалении друга');
        }
    } catch (error) {
        console.error('Error removing friend:', error);
        alert('Ошибка при удалении друга');
    }
}

function switchFriendsTab(tabName) {
    // Update tabs
    document.querySelectorAll('.friend-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });
    
    // Update content
    document.querySelectorAll('.friends-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabName === 'friends') {
        document.getElementById('friendsTab').classList.add('active');
        loadFriends();
    } else {
        document.getElementById('pendingTab').classList.add('active');
        loadPendingRequests();
    }
}

// Make functions available globally for onclick handlers
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;
window.removeFriend = removeFriend;
window.startCall = startCall;

function updateUsersList(users) {
    const usersList = document.getElementById('usersList');
    const onlineCount = users.filter(u => u.status === 'Online').length;
    
    document.getElementById('onlineCount').textContent = onlineCount;
    
    usersList.innerHTML = '';
    
    // Add "Friends" button
    const friendsBtn = document.createElement('div');
    friendsBtn.className = 'user-item';
    friendsBtn.style.cursor = 'pointer';
    friendsBtn.innerHTML = `
        <div class="user-item-avatar" style="background: #5865f2;">👥</div>
        <span>Друзья</span>
    `;
    friendsBtn.addEventListener('click', () => {
        document.getElementById('friendsSection').style.display = 'block';
        document.getElementById('onlineUsers').style.display = 'none';
        switchFriendsTab('friends');
    });
    usersList.appendChild(friendsBtn);
    
    users.forEach(user => {
        if (user.id === currentUser.id) return;
        
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.innerHTML = `
            <div class="user-item-avatar">${user.avatar || user.username.charAt(0).toUpperCase()}</div>
            <span>${user.username}</span>
        `;
        
        userDiv.addEventListener('click', () => {
            startCall('video', user.id);
        });
        
        usersList.appendChild(userDiv);
    });
}

