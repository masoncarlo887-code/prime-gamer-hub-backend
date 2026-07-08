// ==================== VARIÁVEIS GLOBAIS ====================
let token = null;
let currentUser = null;
let products = [];
let cart = [];
let salesHistory = [];
let users = [];
let currentFilter = 'all';
let currentSearch = '';
let currentImageData = null;

// Como deves colocar:
const API_BASE = 'https://prime-gamer-hub-backend.onrender.com';

// ==================== API HELPER ====================
const API = {
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro na requisição');
            }
            
            return response.json();
        } catch (error) {
            console.error('Fetch error:', error);
            throw new Error('Erro de conexão com o servidor. Verifique se o backend está rodando em http://localhost:3000');
        }
    },
    
    async login(username, password) {
        return this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },
    
    async register(username, password, name) {
        return this.request('/api/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, name })
        });
    },
    
    async getProducts() {
        return this.request('/api/products');
    },
    
    async addProduct(productData) {
        const formData = new FormData();
        formData.append('name', productData.name);
        formData.append('category', productData.category);
        formData.append('price', productData.price);
        formData.append('description', productData.description);
        if (productData.image) {
            formData.append('image', productData.image);
        }
        
        const response = await fetch(`${API_BASE}/api/products`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        return response.json();
    },
    
    async getSales() {
        return this.request('/api/sales');
    },
    
    async addSale(saleData) {
        return this.request('/api/sales', {
            method: 'POST',
            body: JSON.stringify(saleData)
        });
    },
    
    async getUsers() {
        return this.request('/api/users');
    },
    
    async deleteUser(id) {
        return this.request(`/api/users/${id}`, { method: 'DELETE' });
    },
    
    async createBackup() {
        return this.request('/api/backup', { method: 'POST' });
    },
    
    async restoreBackup(filename) {
        return this.request(`/api/restore/${filename}`, { method: 'POST' });
    },
    
    async getBackups() {
        return this.request('/api/backups');
    },
    
    async resetData() {
        return this.request('/api/reset', { method: 'POST' });
    }
};

// ==================== UTILITÁRIOS ====================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatPrice(price) {
    return new Intl.NumberFormat('pt-AO', {
        style: 'currency',
        currency: 'AOA',
        minimumFractionDigits: 0
    }).format(price);
}

// ==================== UPLOAD DE IMAGEM ====================
function setupImageUpload() {
    const uploadArea = document.getElementById('imageUploadArea');
    const fileInput = document.getElementById('productImage');
    
    if (!uploadArea) return;
    
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            processImage(file);
        } else {
            showToast('Por favor, selecione um arquivo de imagem válido!', 'error');
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            processImage(e.target.files[0]);
        }
    });
}

function processImage(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione um arquivo de imagem!', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('A imagem deve ter no máximo 5MB!', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentImageData = e.target.result;
        const container = document.getElementById('imagePreviewContainer');
        container.innerHTML = `
            <div class="image-preview">
                <img src="${currentImageData}" alt="Preview">
                <button class="remove-image-btn" onclick="removeImage()">×</button>
            </div>
        `;
        showToast('Imagem carregada com sucesso!', 'success');
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    currentImageData = null;
    document.getElementById('imagePreviewContainer').innerHTML = '';
    document.getElementById('productImage').value = '';
    showToast('Imagem removida!', 'info');
}

// ==================== CARREGAR DADOS ====================
async function loadStoreData() {
    try {
        products = await API.getProducts();
        salesHistory = await API.getSales();
        
        if (currentUser && currentUser.role === 'admin') {
            users = await API.getUsers();
            renderUsersList();
            console.log('👑 Admin - Lista de utilizadores carregada:', users.length);
        } else {
            users = [];
            console.log('🛒 Vendedor - Lista de utilizadores NÃO carregada');
        }
        
        updateStats();
        renderProducts();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showToast('Erro ao carregar dados do servidor', 'error');
    }
}

// ==================== RENDERIZAÇÃO ====================
function renderProducts() {
    let filtered = [...products];
    if (currentFilter !== 'all') filtered = filtered.filter(p => p.category === currentFilter);
    if (currentSearch) filtered = filtered.filter(p => p.name.toLowerCase().includes(currentSearch));
    
    const grid = document.getElementById('productsGrid');
    if (filtered.length === 0) {
        grid.innerHTML = '<div style="text-align:center; padding:50px;">📭 Nenhum produto encontrado</div>';
        return;
    }
    
    grid.innerHTML = filtered.map(product => `
        <div class="product-card">
            <div class="product-image">
                ${product.image ? 
                    `<img src="${API_BASE}${product.image}" alt="${product.name}">` : 
                    `<div class="product-no-image">${product.category === 'PS4' ? '🎮' : product.category === 'PS5' ? '🎮' : '🎧'}</div>`
                }
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <div class="product-price">${formatPrice(product.price)}</div>
                <div class="product-seller">👤 ${product.seller} | 📅 ${product.date}</div>
                <button class="btn-cart" onclick="addToCart(${product.id})">🛒 Adicionar ao Carrinho</button>
                <button class="btn-buy" onclick="buyNow(${product.id})">⚡ Comprar Agora</button>
            </div>
        </div>
    `).join('');
}

function renderUsersList() {
    if (!currentUser || currentUser.role !== 'admin') {
        const container = document.getElementById('usersList');
        if (container) {
            container.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">🔒 Apenas administradores podem ver esta lista</p>';
        }
        return;
    }
    
    const searchTerm = document.getElementById('searchUser')?.value.toLowerCase() || '';
    let filtered = users.filter(u => 
        u.username.toLowerCase().includes(searchTerm) || 
        u.name.toLowerCase().includes(searchTerm)
    );
    
    const container = document.getElementById('usersList');
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum utilizador encontrado</p>';
        return;
    }
    
    container.innerHTML = filtered.map(user => `
        <div class="user-item">
            <div>
                <strong>${user.username}</strong><br>
                <small>${user.name}</small><br>
                <span class="${user.role === 'admin' ? 'admin-badge' : 'seller-badge'}">
                    ${user.role === 'admin' ? '👑 Administrador' : '🛒 Vendedor'}
                </span>
            </div>
            ${user.role !== 'admin' ? 
                `<button class="delete-user-btn" onclick="deleteUser('${user.id}')">🗑️ Eliminar</button>` : 
                '<span style="color:#999;">🔒 Protegido</span>'}
        </div>
    `).join('');
}

function renderHistory() {
    const container = document.getElementById('historyList');
    if (salesHistory.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">📭 Nenhuma venda realizada ainda</p>';
        return;
    }
    
    container.innerHTML = [...salesHistory].reverse().map(sale => `
        <div class="history-item">
            <div>
                <strong>🧾 Pedido #${sale.orderNumber}</strong><br>
                📅 ${sale.date}<br>
                👤 Cliente: ${sale.buyer}<br>
                📦 ${sale.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
            </div>
            <div class="history-total">${formatPrice(sale.total)}</div>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('statProducts').textContent = products.length;
    document.getElementById('statPS4').textContent = products.filter(p => p.category === 'PS4').length;
    document.getElementById('statPS5').textContent = products.filter(p => p.category === 'PS5').length;
    document.getElementById('statAcessorios').textContent = products.filter(p => p.category === 'Acessórios').length;
    document.getElementById('statSales').textContent = salesHistory.length;
    document.getElementById('statUsers').textContent = users.length;
    document.getElementById('cartCount').textContent = cart.reduce((sum, i) => sum + i.quantity, 0);
    document.getElementById('availableCount').textContent = products.length;
}

// ==================== CARRINHO ====================
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existing = cart.find(item => item.id === productId);
    
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateStats();
    showToast(`✅ ${product.name} adicionado ao carrinho!`);
}

function openCart() {
    const modal = document.getElementById('cartModal');
    const container = document.getElementById('cartItems');
    
    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">🛒 Seu carrinho está vazio</p>';
        document.getElementById('cartTotal').textContent = formatPrice(0);
        modal.style.display = 'flex';
        return;
    }
    
    let total = 0;
    container.innerHTML = cart.map(item => {
        total += item.price * item.quantity;
        return `
            <div class="cart-item">
                <div>
                    <strong>${item.name}</strong><br>
                    ${formatPrice(item.price)} cada
                </div>
                <div class="cart-item-actions">
                    <button onclick="updateQuantity(${item.id}, -1)">-</button>
                    <span style="margin:0 10px;">${item.quantity}</span>
                    <button onclick="updateQuantity(${item.id}, 1)">+</button>
                    <button onclick="removeFromCart(${item.id})">🗑️</button>
                </div>
                <div>${formatPrice(item.price * item.quantity)}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('cartTotal').textContent = formatPrice(total);
    modal.style.display = 'flex';
}

function updateQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.id !== productId);
        }
        updateStats();
        openCart();
    }
}

function removeFromCart(productId) {
    cart = cart.filter(i => i.id !== productId);
    updateStats();
    openCart();
}

function closeCart() {
    document.getElementById('cartModal').style.display = 'none';
}

function buyNow(productId) {
    addToCart(productId);
    setTimeout(() => {
        if (confirm('Produto adicionado ao carrinho! Deseja finalizar a compra agora?')) {
            openCart();
        }
    }, 300);
}

async function checkout() {
    if (cart.length === 0) {
        showToast('Carrinho vazio!', 'error');
        return;
    }
    
    const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    
    try {
        await API.addSale({
            items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
            total: total
        });
        
        showToast(`✅ Compra realizada! Total: ${formatPrice(total)}`);
        cart = [];
        updateStats();
        closeCart();
        await loadStoreData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== PRODUTOS ====================
async function addProduct() {
    const name = document.getElementById('productName').value;
    const category = document.getElementById('productCategory').value;
    const price = document.getElementById('productPrice').value;
    const description = document.getElementById('productDescription').value;
    const imageFile = document.getElementById('productImage').files[0];
    
    if (!name || !price || !description) {
        showToast('Preencha todos os campos obrigatórios!', 'error');
        return;
    }
    
    try {
        await API.addProduct({ name, category, price, description, image: imageFile });
        showToast(`✅ "${name}" adicionado com sucesso!`);
        
        document.getElementById('productName').value = '';
        document.getElementById('productPrice').value = '';
        document.getElementById('productDescription').value = '';
        document.getElementById('productImage').value = '';
        document.getElementById('imagePreviewContainer').innerHTML = '';
        currentImageData = null;
        
        await loadStoreData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== ADMIN ====================
async function deleteUser(userId) {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('🔒 Apenas administradores podem eliminar utilizadores!', 'error');
        return;
    }
    
    if (confirm('⚠️ Tem certeza que deseja eliminar este utilizador?')) {
        try {
            await API.deleteUser(userId);
            users = await API.getUsers();
            renderUsersList();
            updateStats();
            showToast('✅ Utilizador eliminado!');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
}

async function createBackup() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('🔒 Apenas administradores podem criar backups!', 'error');
        return;
    }
    
    try {
        await API.createBackup();
        showToast('💾 Backup criado com sucesso!');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function restoreBackup() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('🔒 Apenas administradores podem restaurar backups!', 'error');
        return;
    }
    
    try {
        const backups = await API.getBackups();
        if (backups.length === 0) {
            showToast('Nenhum backup encontrado!', 'error');
            return;
        }
        
        const latest = backups[backups.length - 1];
        if (confirm(`Restaurar backup de ${latest.date}?`)) {
            await API.restoreBackup(latest.name);
            showToast('📀 Backup restaurado com sucesso!');
            await loadStoreData();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function resetData() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('🔒 Apenas administradores podem resetar dados!', 'error');
        return;
    }
    
    if (confirm('⚠️ ATENÇÃO: Isso irá apagar TODOS os dados! Continuar?')) {
        try {
            await API.resetData();
            showToast('🗑️ Dados resetados com sucesso!');
            await loadStoreData();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
}

// ==================== NAVEGAÇÃO ====================
function searchProducts() {
    currentSearch = document.getElementById('searchInput').value.toLowerCase();
    renderProducts();
}

function searchUsers() {
    renderUsersList();
}

function filterByCategory(category) {
    currentFilter = category;
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderProducts();
}

function goToHome() {
    currentFilter = 'all';
    currentSearch = '';
    document.getElementById('searchInput').value = '';
    renderProducts();
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.cat-btn').classList.add('active');
    showToast('🏠 Página inicial', 'info');
}

function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'products') {
        document.getElementById('productsTab').style.display = 'block';
        renderProducts();
    } else if (tab === 'addProduct') {
        document.getElementById('addProductTab').style.display = 'block';
        setupImageUpload();
    } else if (tab === 'history') {
        document.getElementById('historyTab').style.display = 'block';
        renderHistory();
    } else if (tab === 'admin') {
        if (currentUser && currentUser.role === 'admin') {
            document.getElementById('adminTab').style.display = 'block';
            renderUsersList();
            console.log('👑 Admin acessou o painel admin');
        } else {
            showToast('🔒 Apenas administradores podem aceder ao painel admin!', 'error');
            document.getElementById('productsTab').style.display = 'block';
            renderProducts();
            document.querySelectorAll('.nav-btn').forEach(btn => {
                if (btn.textContent.includes('Produtos')) {
                    btn.classList.add('active');
                }
            });
        }
    }
    event.target.classList.add('active');
}

// ==================== FUNÇÕES DE TELA ====================
function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('registerScreen').style.display = 'none';
    document.getElementById('storeScreen').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('registerScreen').style.display = 'flex';
    document.getElementById('storeScreen').style.display = 'none';
}

function showStoreScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('registerScreen').style.display = 'none';
    document.getElementById('storeScreen').style.display = 'block';
    
    document.getElementById('userName').innerHTML = `👤 ${currentUser.name} | ${currentUser.role === 'admin' ? '👑 Admin' : '🛒 Vendedor'}`;
    
    const adminBtn = document.getElementById('adminTabBtn');
    if (currentUser.role === 'admin') {
        adminBtn.style.display = 'block';
        console.log('👑 Admin logado - Botão Admin visível');
    } else {
        adminBtn.style.display = 'none';
        console.log('🛒 Vendedor logado - Botão Admin oculto');
    }
    
    loadStoreData();
}

// ==================== LOGIN ====================
async function doLogin(username, password) {
    try {
        const result = await API.login(username, password);
        token = result.token;
        currentUser = result.user;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        showStoreScreen();
        showToast(`🎮 Bem-vindo, ${currentUser.name}!`);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function doRegister(username, password, name) {
    try {
        await API.register(username, password, name);
        showToast('✅ Conta criada! Faça login.', 'success');
        showLogin();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function logout() {
    if (cart.length > 0 && confirm('Tem itens no carrinho. Deseja sair?')) {
        cart = [];
    }
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showLogin();
    showToast('👋 Logout realizado!');
}

// ==================== MODO CLARO/ESCURO ====================
function toggleTheme() {
    const html = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');
    
    const currentTheme = html.getAttribute('data-theme');
    
    if (currentTheme === 'dark') {
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (themeIcon) themeIcon.textContent = '🌙';
        showToast('☀️ Modo claro ativado', 'info');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (themeIcon) themeIcon.textContent = '☀️';
        showToast('🌙 Modo escuro ativado', 'info');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('themeIcon');
    
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        document.documentElement.removeAttribute('data-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

// ==================== ENTRAR NA LOJA ====================
function enterStore() {
    const hero = document.getElementById('heroSection');
    hero.style.opacity = '0';
    setTimeout(() => {
        hero.style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
    }, 500);
}

// ==================== EVENTOS ====================
document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    doLogin(document.getElementById('loginUsername').value, document.getElementById('loginPassword').value);
});

document.getElementById('registerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    doRegister(document.getElementById('regUsername').value, document.getElementById('regPassword').value, document.getElementById('regName').value);
});

// ==================== INICIALIZAÇÃO ====================

// Carregar tema
loadTheme();

// Verificar sessão
const savedToken = localStorage.getItem('token');
const savedUser = localStorage.getItem('user');

if (savedToken && savedUser) {
    token = savedToken;
    currentUser = JSON.parse(savedUser);
    showStoreScreen();
} else {
    showLogin();
}

// Fechar modal do carrinho clicando fora
window.onclick = (event) => {
    const modal = document.getElementById('cartModal');
    if (event.target === modal) closeCart();
};

console.log('🚀 Prime Gamer Hub - Frontend carregado!');
console.log('👤 Utilizador atual:', currentUser ? `${currentUser.username} (${currentUser.role})` : 'Nenhum');
