const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'prime-gamer-hub-secret-key-2024';

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(process.cwd(), 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== GARANTIR PASTAS NECESSÁRIAS ====================
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Pasta criada: ${dir}`);
    }
};

ensureDir(path.join(__dirname, 'uploads'));
ensureDir(path.join(__dirname, 'data'));
ensureDir(path.join(__dirname, 'data/backups'));

// ==================== CONFIGURAÇÃO DO MULTER PARA UPLOAD ====================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'produto-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Apenas imagens são permitidas!'));
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ==================== FUNÇÕES DE LEITURA/ESCRITA ====================

function readJSON(filePath, defaultData) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
            console.log(`📄 Arquivo criado: ${filePath}`);
            return defaultData;
        }
    } catch (error) {
        console.error(`Erro ao ler ${filePath}:`, error);
        return defaultData;
    }
}

function writeJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Erro ao escrever ${filePath}:`, error);
        return false;
    }
}

// ==================== DADOS PADRÃO ====================

const getDefaultUsers = () => {
    return [{
        id: uuidv4(),
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10),
        name: 'Administrador',
        role: 'admin',
        date: new Date().toISOString()
    }];
};

const getDefaultProducts = () => {
    return [
        { id: 1, name: "The Last of Us Part II", category: "PS4", price: 45000, description: "Jogo exclusivo PS4 - Edição Padrão. História emocionante e gráficos incríveis.", seller: "admin", date: "2024-01-15", image: null },
        { id: 2, name: "Spider-Man: Miles Morales", category: "PS5", price: 55000, description: "Jogo exclusivo PS5 - Ultimate Edition. Gráficos em 4K e Ray Tracing.", seller: "admin", date: "2024-01-20", image: null },
        { id: 3, name: "DualSense Wireless Controller", category: "Acessórios", price: 85000, description: "Controle sem fio para PS5. Feedback tátil e gatilhos adaptáveis.", seller: "admin", date: "2024-01-10", image: null }
    ];
};

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

function isAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
}

// ==================== ROTAS PÚBLICAS ====================

// Rota raiz - serve o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ==================== ROTAS DE AUTENTICAÇÃO ====================

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = readJSON(path.join(__dirname, 'data/users.json'), getDefaultUsers());
        
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Senha incorreta' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, name: user.name },
            SECRET_KEY,
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Registro
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, name } = req.body;
        const users = readJSON(path.join(__dirname, 'data/users.json'), getDefaultUsers());
        
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Preencha todos os campos' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username deve ter pelo menos 3 caracteres' });
        }
        
        if (password.length < 4) {
            return res.status(400).json({ error: 'Password deve ter pelo menos 4 caracteres' });
        }
        
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'Username já existe' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            username,
            password: hashedPassword,
            name,
            role: 'seller',
            date: new Date().toISOString()
        };
        
        users.push(newUser);
        writeJSON(path.join(__dirname, 'data/users.json'), users);
        
        res.status(201).json({
            message: 'Usuário criado com sucesso',
            user: { id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role }
        });
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ==================== ROTAS DE USUÁRIOS (APENAS ADMIN) ====================

// Listar todos os usuários
app.get('/api/users', authenticateToken, isAdmin, (req, res) => {
    try {
        const users = readJSON(path.join(__dirname, 'data/users.json'), getDefaultUsers());
        const safeUsers = users.map(u => ({
            id: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
            date: u.date
        }));
        res.json(safeUsers);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

// Eliminar usuário
app.delete('/api/users/:id', authenticateToken, isAdmin, (req, res) => {
    try {
        const { id } = req.params;
        let users = readJSON(path.join(__dirname, 'data/users.json'), getDefaultUsers());
        
        const userToDelete = users.find(u => u.id === id);
        if (!userToDelete) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        if (userToDelete.role === 'admin') {
            return res.status(403).json({ error: 'Não é possível eliminar o administrador principal' });
        }
        
        users = users.filter(u => u.id !== id);
        writeJSON(path.join(__dirname, 'data/users.json'), users);
        
        res.json({ message: 'Usuário eliminado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao eliminar usuário' });
    }
});

// ==================== ROTAS DE PRODUTOS ====================

// Listar produtos (público)
app.get('/api/products', (req, res) => {
    try {
        const products = readJSON(path.join(__dirname, 'data/products.json'), getDefaultProducts());
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

// Adicionar produto (autenticado)
app.post('/api/products', authenticateToken, upload.single('image'), (req, res) => {
    try {
        const products = readJSON(path.join(__dirname, 'data/products.json'), getDefaultProducts());
        
        const newProduct = {
            id: Date.now(),
            name: req.body.name,
            category: req.body.category,
            price: parseFloat(req.body.price),
            description: req.body.description,
            seller: req.user.username,
            date: new Date().toISOString().split('T')[0],
            image: req.file ? `/uploads/${req.file.filename}` : null
        };
        
        products.push(newProduct);
        writeJSON(path.join(__dirname, 'data/products.json'), products);
        
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        res.status(500).json({ error: 'Erro ao adicionar produto' });
    }
});

// Eliminar produto
app.delete('/api/products/:id', authenticateToken, (req, res) => {
    try {
        let products = readJSON(path.join(__dirname, 'data/products.json'), getDefaultProducts());
        const productId = parseInt(req.params.id);
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        if (req.user.role !== 'admin' && product.seller !== req.user.username) {
            return res.status(403).json({ error: 'Apenas o administrador ou o dono pode eliminar este produto' });
        }
        
        products = products.filter(p => p.id !== productId);
        writeJSON(path.join(__dirname, 'data/products.json'), products);
        
        res.json({ message: 'Produto eliminado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao eliminar produto' });
    }
});

// ==================== ROTAS DE VENDAS ====================

// Registrar venda
app.post('/api/sales', authenticateToken, (req, res) => {
    try {
        const sales = readJSON(path.join(__dirname, 'data/sales.json'), []);
        const { items, total } = req.body;
        
        const newSale = {
            id: Date.now(),
            orderNumber: Math.floor(Math.random() * 10000),
            date: new Date().toLocaleString(),
            items: items,
            total: total,
            buyer: req.user.username
        };
        
        sales.push(newSale);
        writeJSON(path.join(__dirname, 'data/sales.json'), sales);
        
        res.status(201).json(newSale);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao registrar venda' });
    }
});

// Listar vendas
app.get('/api/sales', authenticateToken, (req, res) => {
    try {
        const sales = readJSON(path.join(__dirname, 'data/sales.json'), []);
        res.json(sales);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar vendas' });
    }
});

// ==================== ROTAS DE BACKUP ====================

// Criar backup
app.post('/api/backup', authenticateToken, isAdmin, (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'data/backups/');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = `${backupDir}backup_${timestamp}.json`;
        
        const backupData = {
            date: new Date().toISOString(),
            users: readJSON(path.join(__dirname, 'data/users.json'), getDefaultUsers()),
            products: readJSON(path.join(__dirname, 'data/products.json'), getDefaultProducts()),
            sales: readJSON(path.join(__dirname, 'data/sales.json'), [])
        };
        
        writeJSON(backupFile, backupData);
        
        res.json({ message: 'Backup criado com sucesso', file: backupFile });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar backup' });
    }
});

// Listar backups
app.get('/api/backups', authenticateToken, isAdmin, (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'data/backups/');
        if (!fs.existsSync(backupDir)) {
            return res.json([]);
        }
        
        const files = fs.readdirSync(backupDir);
        const backups = files.map(file => ({
            name: file,
            date: file.replace('backup_', '').replace('.json', '')
        }));
        
        res.json(backups);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar backups' });
    }
});

// Restaurar backup
app.post('/api/restore/:filename', authenticateToken, isAdmin, (req, res) => {
    try {
        const { filename } = req.params;
        const backupFile = path.join(__dirname, `data/backups/${filename}`);
        
        if (!fs.existsSync(backupFile)) {
            return res.status(404).json({ error: 'Backup não encontrado' });
        }
        
        const backupData = readJSON(backupFile, {});
        
        if (backupData.users) writeJSON(path.join(__dirname, 'data/users.json'), backupData.users);
        if (backupData.products) writeJSON(path.join(__dirname, 'data/products.json'), backupData.products);
        if (backupData.sales) writeJSON(path.join(__dirname, 'data/sales.json'), backupData.sales);
        
        res.json({ message: 'Backup restaurado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao restaurar backup' });
    }
});

// Resetar todos os dados
app.post('/api/reset', authenticateToken, isAdmin, (req, res) => {
    try {
        writeJSON(path.join(__dirname, 'data/users.json'), getDefaultUsers());
        writeJSON(path.join(__dirname, 'data/products.json'), getDefaultProducts());
        writeJSON(path.join(__dirname, 'data/sales.json'), []);
        
        res.json({ message: 'Dados resetados com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao resetar dados' });
    }
});

// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('🚀 Prime Gamer Hub - Backend');
    console.log('========================================');
    console.log(`📡 Servidor: http://localhost:${PORT}`);
    console.log(`📁 Dados: ${path.join(__dirname, 'data')}`);
    console.log(`🖼️  Uploads: ${path.join(__dirname, 'uploads')}`);
    console.log('========================================');
    console.log('🔐 Credenciais padrão:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('========================================\n');
});
