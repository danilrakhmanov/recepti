// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAkGM_gzf97M0MXz--KV8__wlIwVCiqMqY",
    authDomain: "recepti-93f83.firebaseapp.com",
    projectId: "recepti-93f83",
    storageBucket: "recepti-93f83.firebasestorage.app",
    messagingSenderId: "476919885625",
    appId: "1:476919885625:web:4ad8450fabcc07adf7c2e8",
    measurementId: "G-SMMQ8KWS5K"
};

// Initialize Firebase
let db = null;
let auth = null;
let useFirebase = false;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    useFirebase = true;
    console.log('Firebase initialized successfully');
} catch (error) {
    console.warn('Firebase not configured, using localStorage:', error.message);
    useFirebase = false;
}

// Auth Manager Class
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.googleProvider = null;
        this.init();
    }

    init() {
        if (useFirebase && auth) {
            // Initialize Google provider
            this.googleProvider = new firebase.auth.GoogleAuthProvider();
            
            // Listen for auth state changes
            auth.onAuthStateChanged(async (user) => {
                this.currentUser = user;
                this.updateUI();
                
                if (user) {
                    console.log('User signed in:', user.email);
                    
                    // Sync data after sign in
                    if (window.recipeBook) {
                        const displayName = user.displayName || user.email;
                        window.recipeBook.showToast(`Добро пожаловать, ${displayName}! 👋`);
                        
                        // Sync data with server
                        await this.syncUserData();
                    }
                } else {
                    console.log('User signed out');
                    
n                }
            });
        }
    }

    // Sync user data: upload local data to Firebase, then load from Firebase
    async syncUserData() {
        if (!useFirebase || !db || !this.currentUser) return;
        
        try {
            const userId = this.currentUser.uid;
            console.log('Syncing data for user:', userId);
            
            // Get references to user subcollections
            const userDocRef = db.collection('users').doc(userId);
            
            // Upload local data to Firebase
            await this.uploadLocalDataToFirebase(userId);
            
            // Then load data from Firebase
            await this.loadDataFromFirebase(userId);
            
            console.log('Data synced successfully');
        } catch (error) {
            console.error('Error syncing user data:', error);
        }
    }

    // Upload localStorage data to Firebase
    async uploadLocalDataToFirebase(userId) {
        if (!db) return;
        
        try {
            const collections = ['recipes', 'shoppingList', 'weeklyMenu'];
            
            for (const coll of collections) {
                const localData = localStorage.getItem(coll);
                if (localData) {
                    const data = JSON.parse(localData);
                    if (data && data.length > 0) {
                        // Upload to user's subcollection
                        await db.collection('users').doc(userId).collection('data').doc(coll).set({
                            items: data,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        console.log(`Uploaded ${coll} to Firebase:`, data.length, 'items');
                    }
                }
            }
        } catch (error) {
            console.error('Error uploading local data:', error);
        }
    }

    // Load data from Firebase for user
    async loadDataFromFirebase(userId) {
        if (!db || !window.recipeBook) return;
        
        try {
            const snapshot = await db.collection('users').doc(userId).collection('data').get();
            
            snapshot.forEach(doc => {
                const coll = doc.id;
                const data = doc.data();
                if (data && data.items) {
                    // Update recipeBook with Firebase data
                    if (coll === 'recipes') {
                        window.recipeBook.recipes = data.items;
                        window.recipeBook.saveToLocalStorage();
                        window.recipeBook.renderRecipes();
                        console.log('Loaded recipes from Firebase:', data.items.length);
                    } else if (coll === 'shoppingList') {
                        window.recipeBook.items = data.items;
                        window.recipeBook.saveToLocalStorage();
                        console.log('Loaded shopping list from Firebase:', data.items.length);
                    } else if (coll === 'weeklyMenu') {
                        window.recipeBook.menu = data.items;
                        window.recipeBook.saveToLocalStorage();
                        console.log('Loaded menu from Firebase');
                    }
                }
            });
        } catch (error) {
            console.error('Error loading data from Firebase:', error);
        }
    }

    // Get user data reference path
    getUserCollectionPath(collectionName) {
        if (!this.currentUser) return null;
        return `users/${this.currentUser.uid}/data/${collectionName}`;
    }

    updateUI() {
        const authToggle = document.getElementById('authToggle');
        const authText = document.getElementById('authText');
        const authIcon = document.querySelector('.auth-icon');

        if (this.currentUser) {
            authText.textContent = 'Выйти';
            authIcon.textContent = '🚪';
            authToggle.title = 'Выйти из аккаунта';
        } else {
            authText.textContent = 'Войти';
            authIcon.textContent = '👤';
            authToggle.title = 'Войти в аккаунт';
        }
    }

    async signIn(email, password) {
        if (!useFirebase || !auth) {
            throw new Error('Firebase Auth не доступен');
        }

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            return userCredential.user;
        } catch (error) {
            console.error('Sign in error:', error);
            throw this.getAuthError(error);
        }
    }

    async signUp(email, password, name) {
        if (!useFirebase || !auth) {
            throw new Error('Firebase Auth не доступен');
        }

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            
            // Update user profile with name
            if (name) {
                await userCredential.user.updateProfile({
                    displayName: name
                });
            }
            
            return userCredential.user;
        } catch (error) {
            console.error('Sign up error:', error);
            throw this.getAuthError(error);
        }
    }

    async signInWithGoogle() {
        if (!useFirebase || !auth) {
            throw new Error('Firebase Auth не доступен');
        }

        try {
            const result = await auth.signInWithPopup(this.googleProvider);
            return result.user;
        } catch (error) {
            console.error('Google sign in error:', error);
            throw this.getAuthError(error);
        }
    }

    async signOut() {
        if (!useFirebase || !auth) {
            return;
        }

        try {
            await auth.signOut();
            if (window.recipeBook) {
                window.recipeBook.showToast('Вы вышли из аккаунта 👋');
            }
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    getAuthError(error) {
        const errorMessages = {
            'auth/email-already-in-use': 'Этот email уже зарегистрирован',
            'auth/invalid-email': 'Некорректный email',
            'auth/weak-password': 'Пароль должен содержать минимум 6 символов',
            'auth/user-not-found': 'Пользователь не найден',
            'auth/wrong-password': 'Неверный пароль',
            'auth/invalid-login-credentials': 'Неверный email или пароль',
            'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
            'auth/network-request-failed': 'Ошибка сети. Проверьте подключение к интернету',
            'auth/popup-closed-by-user': 'Окно входа было закрыто',
            'auth/cancelled-popup-request': 'Вход через Google был отменен',
            'auth/unauthorized-domain': 'Домен не авторизован для Google OAuth'
        };

        return errorMessages[error.code] || error.message || 'Произошла ошибка';
    }
}

// Recipe Parser Class
class RecipeParser {
    constructor() {
        this.parsers = {
            'povarenok.ru': this.parsePovarenok.bind(this),
            'eda.ru': this.parseEda.bind(this),
            'vkusno.ru': this.parseVkusno.bind(this),
            'gotovim.ru': this.parseGotovim.bind(this),
            'russianfood.com': this.parseRussianFood.bind(this),
            'allrecipes.ru': this.parseAllRecipes.bind(this),
            'default': this.parseGeneric.bind(this)
        };
    }

    // Parse recipe from URL
    async parseFromUrl(url) {
        try {
            // Use CORS proxy to fetch the page with timeout
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

            const response = await fetch(proxyUrl, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Не удалось загрузить страницу. Код: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.contents) {
                throw new Error('Не удалось получить содержимое страницы');
            }

            // Parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');

            // Determine which parser to use based on domain
            const domain = this.extractDomain(url);
            const parseFunction = this.parsers[domain] || this.parsers['default'];

            // Parse recipe data
            const recipeData = parseFunction(doc, url);

            // Log parsed data for debugging
            console.log('Parsed recipe data:', recipeData);

            return recipeData;
        } catch (error) {
            console.error('Error parsing recipe:', error);
            if (error.name === 'AbortError') {
                throw new Error('Превышено время ожидания. Попробуйте другой сайт.');
            }
            throw error;
        }
    }

    // Extract domain from URL
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            
            // Check for known domains
            if (hostname.includes('povarenok.ru')) return 'povarenok.ru';
            if (hostname.includes('eda.ru')) return 'eda.ru';
            if (hostname.includes('vkusno.ru')) return 'vkusno.ru';
            if (hostname.includes('gotovim.ru')) return 'gotovim.ru';
            if (hostname.includes('russianfood.com')) return 'russianfood.com';
            if (hostname.includes('allrecipes.ru')) return 'allrecipes.ru';
            
            return 'default';
        } catch (error) {
            return 'default';
        }
    }

    // Parse Povarenok.ru
    parsePovarenok(doc, url) {
        const recipe = {
            name: '',
            description: '',
            cookingTime: '',
            servings: '',
            imageUrl: '',
            ingredients: [],
            steps: []
        };

        // Name
        const nameEl = doc.querySelector('h1.recipe-title, h1.title, .recipe-header h1');
        recipe.name = nameEl ? nameEl.textContent.trim() : '';

        // Description
        const descEl = doc.querySelector('.recipe-description, .description, .recipe-summary');
        recipe.description = descEl ? descEl.textContent.trim() : '';

        // Cooking time
        const timeEl = doc.querySelector('.recipe-time, .cooking-time, .time');
        recipe.cookingTime = timeEl ? timeEl.textContent.trim() : '';

        // Servings
        const servingsEl = doc.querySelector('.recipe-servings, .servings, .portions');
        recipe.servings = servingsEl ? servingsEl.textContent.trim() : '';

        // Image
        const imgEl = doc.querySelector('.recipe-image img, .recipe-photo img, .main-photo img');
        recipe.imageUrl = imgEl ? imgEl.src : '';

        // Ingredients
        const ingredientsList = doc.querySelectorAll('.recipe-ingredients li, .ingredients li, .ingredient-item');
        ingredientsList.forEach(item => {
            const text = item.textContent.trim();
            if (text) {
                // Try to separate name and quantity
                const match = text.match(/^([^—–-]+)[—–-]?\s*(.*)$/);
                if (match) {
                    recipe.ingredients.push({
                        name: match[1].trim(),
                        quantity: match[2].trim()
                    });
                } else {
                    recipe.ingredients.push({
                        name: text,
                        quantity: ''
                    });
                }
            }
        });

        // Steps
        const stepsList = doc.querySelectorAll('.recipe-steps li, .steps li, .instruction-step');
        stepsList.forEach((step, index) => {
            const text = step.textContent.trim();
            if (text) {
                recipe.steps.push({
                    text: text,
                    image: ''
                });
            }
        });

        return recipe;
    }

    // Parse Eda.ru
    parseEda(doc, url) {
        const recipe = {
            name: '',
            description: '',
            cookingTime: '',
            servings: '',
            imageUrl: '',
            ingredients: [],
            steps: []
        };

        // Name
        const nameEl = doc.querySelector('h1.recipe__name, h1.title');
        recipe.name = nameEl ? nameEl.textContent.trim() : '';

        // Description
        const descEl = doc.querySelector('.recipe__description, .description');
        recipe.description = descEl ? descEl.textContent.trim() : '';

        // Cooking time
        const timeEl = doc.querySelector('.recipe__time, .time');
        recipe.cookingTime = timeEl ? timeEl.textContent.trim() : '';

        // Servings
        const servingsEl = doc.querySelector('.recipe__servings, .servings');
        recipe.servings = servingsEl ? servingsEl.textContent.trim() : '';

        // Image
        const imgEl = doc.querySelector('.recipe__image img, .recipe-photo img');
        recipe.imageUrl = imgEl ? imgEl.src : '';

        // Ingredients
        const ingredientsList = doc.querySelectorAll('.recipe__ingredients li, .ingredients-list li');
        ingredientsList.forEach(item => {
            const text = item.textContent.trim();
            if (text) {
                const match = text.match(/^([^—–-]+)[—–-]?\s*(.*)$/);
                if (match) {
                    recipe.ingredients.push({
                        name: match[1].trim(),
                        quantity: match[2].trim()
                    });
                } else {
                    recipe.ingredients.push({
                        name: text,
                        quantity: ''
                    });
                }
            }
        });

        // Steps
        const stepsList = doc.querySelectorAll('.recipe__steps li, .steps-list li');
        stepsList.forEach((step, index) => {
            const text = step.textContent.trim();
            if (text) {
                recipe.steps.push({
                    text: text,
                    image: ''
                });
            }
        });

        return recipe;
    }

    // Parse Vkusno.ru
    parseVkusno(doc, url) {
        const recipe = {
            name: '',
            description: '',
            cookingTime: '',
            servings: '',
            imageUrl: '',
            ingredients: [],
            steps: []
        };

        // Name
        const nameEl = doc.querySelector('h1.recipe-title, h1');
        recipe.name = nameEl ? nameEl.textContent.trim() : '';

        // Description
        const descEl = doc.querySelector('.recipe-desc, .description');
        recipe.description = descEl ? descEl.textContent.trim() : '';

        // Cooking time
        const timeEl = doc.querySelector('.recipe-time, .time-info');
        recipe.cookingTime = timeEl ? timeEl.textContent.trim() : '';

        // Servings
        const servingsEl = doc.querySelector('.recipe-servings, .servings-info');
        recipe.servings = servingsEl ? servingsEl.textContent.trim() : '';

        // Image
        const imgEl = doc.querySelector('.recipe-img img, .main-image img');
        recipe.imageUrl = imgEl ? imgEl.src : '';

        // Ingredients
        const ingredientsList = doc.querySelectorAll('.ingredients-list li, .ingredient');
        ingredientsList.forEach(item => {
            const text = item.textContent.trim();
            if (text) {
                const match = text.match(/^([^—–-]+)[—–-]?\s*(.*)$/);
                if (match) {
                    recipe.ingredients.push({
                        name: match[1].trim(),
                        quantity: match[2].trim()
                    });
                } else {
                    recipe.ingredients.push({
                        name: text,
                        quantity: ''
                    });
                }
            }
        });

        // Steps
        const stepsList = doc.querySelectorAll('.steps-list li, .step');
        stepsList.forEach((step, index) => {
            const text = step.textContent.trim();
            if (text) {
                recipe.steps.push({
                    text: text,
                    image: ''
                });
            }
        });

        return recipe;
    }

    // Parse Gotovim.ru
    parseGotovim(doc, url) {
        const recipe = {
            name: '',
            description: '',
            cookingTime: '',
            servings: '',
            imageUrl: '',
            ingredients: [],
            steps: []
        };

        // Name
        const nameEl = doc.querySelector('h1.recipe-name, h1');
        recipe.name = nameEl ? nameEl.textContent.trim() : '';

        // Description
        const descEl = doc.querySelector('.recipe-description, .desc');
        recipe.description = descEl ? descEl.textContent.trim() : '';

        // Cooking time
        const timeEl = doc.querySelector('.recipe-time, .time');
        recipe.cookingTime = timeEl ? timeEl.textContent.trim() : '';

        // Servings
        const servingsEl = doc.querySelector('.recipe-servings, .servings');
        recipe.servings = servingsEl ? servingsEl.textContent.trim() : '';

        // Image
        const imgEl = doc.querySelector('.recipe-image img, .photo img');
        recipe.imageUrl = imgEl ? imgEl.src : '';

        // Ingredients
        const ingredientsList = doc.querySelectorAll('.ingredients li, .ingredient-item');
        ingredientsList.forEach(item => {
            const text = item.textContent.trim();
            if (text) {
                const match = text.match(/^([^—–-]+)[—–-]?\s*(.*)$/);
                if (match) {
                    recipe.ingredients.push({
                        name: match[1].trim(),
                        quantity: match[2].trim()
                    });
                } else {
                    recipe.ingredients.push({
                        name: text,
                        quantity: ''
                    });
                }
            }
        });

        // Steps
        const stepsList = doc.querySelectorAll('.steps li, .step-item');
        stepsList.forEach((step, index) => {
            const text = step.textContent.trim();
            if (text) {
                recipe.steps.push({
                    text: text,
                    image: ''
                });
            }
        });

        return recipe;
    }

    // Parse RussianFood.com
    parseRussianFood(doc, url) {
        const recipe = {
            name: '',
            description: '',
            cookingTime: '',
            servings: '',
            imageUrl: '',
            ingredients: [],
            steps: []
        };

        // Name - try multiple selectors
        const nameSelectors = [
            'h1.title',
            'h1.recipe-title',
            'h1',
            '.recipe-header h1',
            '[itemprop="name"]'
        ];
        for (const selector of nameSelectors) {
            const nameEl = doc.querySelector(selector);
            if (nameEl && nameEl.textContent.trim()) {
                recipe.name = nameEl.textContent.trim();
                break;
            }
        }

        // Description - try multiple selectors
        const descSelectors = [
            '.recipe-description',
            '.description',
            '.recipe-summary',
            '[itemprop="description"]',
            '.recipe-text'
        ];
        for (const selector of descSelectors) {
            const descEl = doc.querySelector(selector);
            if (descEl && descEl.textContent.trim()) {
                recipe.description = descEl.textContent.trim();
                break;
            }
        }

        // Cooking time - try multiple selectors
        const timeSelectors = [
            '.recipe-time',
            '.time',
            '.cooking-time',
            '[itemprop="totalTime"]',
            '[itemprop="cookTime"]',
            '.time-info'
        ];
        for (const selector of timeSelectors) {
            const timeEl = doc.querySelector(selector);
            if (timeEl && timeEl.textContent.trim()) {
                recipe.cookingTime = timeEl.textContent.trim();
                break;
            }
        }

        // Servings - try multiple selectors
        const servingsSelectors = [
            '.recipe-servings',
            '.servings',
            '.portions',
            '[itemprop="recipeYield"]',
            '.servings-info'
        ];
        for (const selector of servingsSelectors) {
            const servingsEl = doc.querySelector(selector);
            if (servingsEl && servingsEl.textContent.trim()) {
                recipe.servings = servingsEl.textContent.trim();
                break;
            }
        }

        // Image - try multiple selectors
        const imgSelectors = [
            '.recipe-image img',
            '.photo img',
            '.main-image img',
            'img[itemprop="image"]',
            '.recipe-photo img',
            '.recipe-img img'
        ];
        for (const selector of imgSelectors) {
            const imgEl = doc.querySelector(selector);
            if (imgEl && imgEl.src) {
                recipe.imageUrl = imgEl.src;
                break;
            }
        }

        // Ingredients - try multiple selectors
        const ingredientsSelectors = [
            '.ingredients li',
            '.ingredient-list li',
            '[itemprop="recipeIngredient"]',
            '.recipe-ingredients li',
            '.ingr-list li',
            '.ingredient-item'
        ];
        for (const selector of ingredientsSelectors) {
            const ingredientsList = doc.querySelectorAll(selector);
            if (ingredientsList.length > 0) {
                ingredientsList.forEach(item => {
                    const text = item.textContent.trim();
                    if (text) {
                        const match = text.match(/^([^—–-]+)[—–-]?\s*(.*)$/);
                        if (match) {
                            recipe.ingredients.push({
                                name: match[1].trim(),
                                quantity: match[2].trim()
                            });
                        } else {
                            recipe.ingredients.push({
                                name: text,
                                quantity: ''
                            });
                        }
                    }
                });
                break;
            }
        }

        // Steps - try multiple selectors
        const stepsSelectors = [
            '.steps li',
            '.instructions li',
            '[itemprop="recipeInstructions"]',
            '.recipe-steps li',
            '.step-list li',
            '.step-item',
            '.instruction-step'
        ];
        for (const selector of stepsSelectors) {
            const stepsList = doc.querySelectorAll(selector);
            if (stepsList.length > 0) {
                stepsList.forEach((step, index) => {
                    const text = step.textContent.trim();
                    if (text) {
                        recipe.steps.push({
                            text: text,
                            image: ''
                        });
                    }
                });
                break;
            }
        }

        return recipe;
    }

    // Parse AllRecipes.ru
    parseAllRecipes(doc, url) {
        const recipe = {
            name: '',
            description: '',
            cookingTime: '',
            servings: '',
            imageUrl: '',
            ingredients: [],
            steps: []
        };

        // Name
        const nameEl = doc.querySelector('h1.recipe-title, h1');
        recipe.name = nameEl ? nameEl.textContent.trim() : '';

        // Description
        const descEl = doc.querySelector('.recipe-description, .description');
        recipe.description = descEl ? descEl.textContent.trim() : '';

        // Cooking time
        const timeEl = doc.querySelector('.recipe-time, .time');
        recipe.cookingTime = timeEl ? timeEl.textContent.trim() : '';

        // Servings
        const servingsEl = doc.querySelector('.recipe-servings, .servings');
        recipe.servings = servingsEl ? servingsEl.textContent.trim() : '';

        // Image
        const imgEl = doc.querySelector('.recipe-image img, .photo img');
        recipe.imageUrl = imgEl ? imgEl.src : '';

        // Ingredients
        const ingredientsList = doc.querySelectorAll('.ingredients li, .ingredient-item');
        ingredientsList.forEach(item => {
            const text = item.textContent.trim();
            if (text) {
                const match = text.match(/^([^—–-]+)[—–-]?\s*(.*)$/);
                if (match) {
                    recipe.ingredients.push({
                        name: match[1].trim(),
                        quantity: match[2].trim()
                    });
                } else {
                    recipe.ingredients.push({
                        name: text,
                        quantity: ''
                    });
                }
            }
        });

        // Steps
        const stepsList = doc.querySelectorAll('.steps li, .step-item');
        stepsList.forEach((step, index) => {
            const text = step.textContent.trim();
            if (text) {
                recipe.steps.push({
                    text: text,
                    image: ''
                });
            }
        });

        return recipe;
    }

    // Generic parser for unknown sites
    parseGeneric(doc, url) {
        const recipe = {
            name: '',
            description: '',
            cookingTime: '',
            servings: '',
            imageUrl: '',
            ingredients: [],
            steps: []
        };

        console.log('Starting generic parser for:', url);

        // Try to find title
        const titleSelectors = [
            'h1',
            '.title',
            '.recipe-title',
            '[itemprop="name"]',
            'h2',
            '.recipe-name'
        ];
        for (const selector of titleSelectors) {
            const titleEl = doc.querySelector(selector);
            if (titleEl && titleEl.textContent.trim()) {
                recipe.name = titleEl.textContent.trim();
                console.log('Found title:', recipe.name);
                break;
            }
        }

        // Try to find description
        const descSelectors = [
            '.description',
            '.recipe-description',
            '[itemprop="description"]',
            '.recipe-summary',
            '.recipe-text',
            'meta[name="description"]'
        ];
        for (const selector of descSelectors) {
            const descEl = doc.querySelector(selector);
            if (descEl) {
                const text = descEl.textContent || descEl.content;
                if (text && text.trim()) {
                    recipe.description = text.trim();
                    console.log('Found description:', recipe.description.substring(0, 50) + '...');
                    break;
                }
            }
        }

        // Try to find cooking time
        const timeSelectors = [
            '.time',
            '.cooking-time',
            '[itemprop="totalTime"]',
            '[itemprop="cookTime"]',
            '.recipe-time',
            '.time-info'
        ];
        for (const selector of timeSelectors) {
            const timeEl = doc.querySelector(selector);
            if (timeEl && timeEl.textContent.trim()) {
                recipe.cookingTime = timeEl.textContent.trim();
                console.log('Found cooking time:', recipe.cookingTime);
                break;
            }
        }

        // Try to find servings
        const servingsSelectors = [
            '.servings',
            '.portions',
            '[itemprop="recipeYield"]',
            '.recipe-servings',
            '.servings-info'
        ];
        for (const selector of servingsSelectors) {
            const servingsEl = doc.querySelector(selector);
            if (servingsEl && servingsEl.textContent.trim()) {
                recipe.servings = servingsEl.textContent.trim();
                console.log('Found servings:', recipe.servings);
                break;
            }
        }

        // Try to find image
        const imgSelectors = [
            'img[itemprop="image"]',
            '.recipe-image img',
            '.main-image img',
            'img[src*="recipe"]',
            '.recipe-photo img',
            '.recipe-img img',
            'meta[property="og:image"]'
        ];
        for (const selector of imgSelectors) {
            const imgEl = doc.querySelector(selector);
            if (imgEl) {
                const src = imgEl.src || imgEl.content;
                if (src) {
                    recipe.imageUrl = src;
                    console.log('Found image:', recipe.imageUrl);
                    break;
                }
            }
        }

        // Try to find ingredients using JSON-LD
        const jsonLdScript = doc.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
            try {
                const jsonLd = JSON.parse(jsonLdScript.textContent);
                console.log('Found JSON-LD:', jsonLd);
                
                if (jsonLd.recipeIngredient) {
                    jsonLd.recipeIngredient.forEach(ing => {
                        const text = typeof ing === 'string' ? ing : ing.text || '';
                        if (text) {
                            const match = text.match(/^([^—–-]+)[—–-]?\s*(.*)$/);
                            if (match) {
                                recipe.ingredients.push({
                                    name: match[1].trim(),
                                    quantity: match[2].trim()
                                });
                            } else {
                                recipe.ingredients.push({
                                    name: text,
                                    quantity: ''
                                });
                            }
                        }
                    });
                    console.log('Found ingredients from JSON-LD:', recipe.ingredients.length);
                }

                if (jsonLd.recipeInstructions) {
                    jsonLd.recipeInstructions.forEach(step => {
                        const text = typeof step === 'string' ? step : step.text || step.name || '';
                        if (text) {
                            recipe.steps.push({
                                text: text,
                                image: ''
                            });
                        }
                    });
                    console.log('Found steps from JSON-LD:', recipe.steps.length);
                }
            } catch (e) {
                console.log('Error parsing JSON-LD:', e);
            }
        }

        // If no ingredients from JSON-LD, try to find them in HTML
        if (recipe.ingredients.length === 0) {
            const ingredientsSelectors = [
                '.ingredients li',
                '.ingredient-list li',
                '[itemprop="recipeIngredient"]',
                '.recipe-ingredients li',
                '.ingr-list li',
                '.ingredient-item',
                '.ingredients-list li'
            ];

            for (const selector of ingredientsSelectors) {
                const items = doc.querySelectorAll(selector);
                if (items.length > 0) {
                    items.forEach(item => {
                        const text = item.textContent.trim();
                        if (text) {
                            const match = text.match(/^([^—–-]+)[—–-]?\s*(.*)$/);
                            if (match) {
                                recipe.ingredients.push({
                                    name: match[1].trim(),
                                    quantity: match[2].trim()
                                });
                            } else {
                                recipe.ingredients.push({
                                    name: text,
                                    quantity: ''
                                });
                            }
                        }
                    });
                    console.log('Found ingredients from HTML:', recipe.ingredients.length);
                    break;
                }
            }
        }

        // If no steps from JSON-LD, try to find them in HTML
        if (recipe.steps.length === 0) {
            const stepsSelectors = [
                '.steps li',
                '.instructions li',
                '[itemprop="recipeInstructions"]',
                '.recipe-steps li',
                '.step-list li',
                '.step-item',
                '.instruction-step',
                '.recipe-instructions li'
            ];

            for (const selector of stepsSelectors) {
                const items = doc.querySelectorAll(selector);
                if (items.length > 0) {
                    items.forEach(item => {
                        const text = item.textContent.trim();
                        if (text) {
                            recipe.steps.push({
                                text: text,
                                image: ''
                            });
                        }
                    });
                    console.log('Found steps from HTML:', recipe.steps.length);
                    break;
                }
            }
        }

        console.log('Final parsed recipe:', recipe);
        return recipe;
    }
}

// Recipe Book Application
class RecipeBook {
    constructor() {
        this.recipes = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.editingId = null;
        this.recipeToDelete = null;
        this.menuPlanner = null;
        this.shoppingList = null;
        this.currentRecipeId = null;
        this.originalServings = 4;
        this.recipeParser = new RecipeParser();
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadRecipes();
        this.renderRecipes();
        this.setupRealtimeSync();
        // Hide loading screen immediately
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }

    // Load recipes from Firebase or localStorage
    async loadRecipes() {
        if (useFirebase && db && window.authManager && window.authManager.currentUser) {
            try {
                const userId = window.authManager.currentUser.uid;
                const doc = await db.collection('users').doc(userId).collection('data').doc('recipes').get();
                
                if (doc.exists && doc.data()) {
                    this.recipes = doc.data().items || [];
                    console.log('Recipes loaded from Firebase for user:', this.recipes.length);
                } else {
                    this.loadFromLocalStorage();
                }
            } catch (error) {
                console.error('Error loading from Firebase:', error);
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
        }
    }

    // Setup real-time sync with Firebase
    setupRealtimeSync() {
        if (useFirebase && db && window.authManager && window.authManager.currentUser) {
            const userId = window.authManager.currentUser.uid;
            
            // Listen for real-time changes
            db.collection('users').doc(userId).collection('data').doc('recipes')
                .onSnapshot((snapshot) => {
                    if (snapshot.exists && snapshot.data()) {
                        const data = snapshot.data();
                        if (data.items) {
                            this.recipes = data.items;
                            this.saveToLocalStorage();
                            this.renderRecipes();
                            console.log('Real-time sync: recipes updated from Firebase');
                        }
                    }
                }, (error) => {
                    console.error('Error listening to recipe changes:', error);
                });

            console.log('Real-time sync enabled for user:', userId);
        }
    }

    // Load from localStorage as fallback
    loadFromLocalStorage() {
        const saved = localStorage.getItem('recipes');
        this.recipes = saved ? JSON.parse(saved) : [];
        console.log('Recipes loaded from localStorage:', this.recipes.length);
    }

    // Save recipes to Firebase or localStorage
    async saveRecipes() {
        // Always save to localStorage first (fast)
        this.saveToLocalStorage();

        // Then save to Firebase in background (async)
        if (useFirebase && db && window.authManager && window.authManager.currentUser) {
            try {
                const userId = window.authManager.currentUser.uid;
                const { id, ...recipeData } = this.recipes;
                
                // Save to user's subcollection
                await db.collection('users').doc(userId).collection('data').doc('recipes').set({
                    items: this.recipes,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('Recipes saved to Firebase for user:', userId);
            } catch (error) {
                console.error('Error saving recipes to Firebase:', error);
            }
        }
    }

    // Save to localStorage as fallback
    saveToLocalStorage() {
        localStorage.setItem('recipes', JSON.stringify(this.recipes));
        console.log('Recipes saved to localStorage');
    }

    // Bind all event listeners
    bindEvents() {
        // My recipes button
        document.getElementById('myRecipesBtn').addEventListener('click', () => {
            this.setFilter('all');
        });

        // Add recipe quick button
        document.getElementById('addRecipeQuickBtn').addEventListener('click', () => {
            this.openModal();
        });

        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            if (btn.id !== 'addRecipeQuickBtn') {
                btn.addEventListener('click', () => {
                    this.setFilter(btn.dataset.filter);
                });
            }
        });

        // Close modal
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal on backdrop click
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });

        // Form submission
        document.getElementById('recipeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addRecipe();
        });

        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderRecipes();
        });

        // Filter tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setFilter(btn.dataset.filter);
            });
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeDeleteModal();
            }
        });

        // Delete modal buttons
        document.getElementById('cancelDelete').addEventListener('click', () => {
            this.closeDeleteModal();
        });

        document.getElementById('confirmDelete').addEventListener('click', () => {
            this.confirmDelete();
        });

        // Close delete modal on backdrop click
        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target.id === 'deleteModal') {
                this.closeDeleteModal();
            }
        });

        // Close detail modal
        document.getElementById('closeDetailModal').addEventListener('click', () => {
            this.closeDetailModal();
        });

        // Close detail modal on backdrop click
        document.getElementById('recipeDetailModal').addEventListener('click', (e) => {
            if (e.target.id === 'recipeDetailModal') {
                this.closeDetailModal();
            }
        });

        // Open recipe button
        document.getElementById('openRecipeBtn').addEventListener('click', () => {
            const recipeUrl = document.getElementById('detailUrl').href;
            if (recipeUrl && recipeUrl !== '#') {
                window.open(recipeUrl, '_blank');
            }
        });

        // Mobile navigation
        document.querySelectorAll('.mobile-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.setFilter(item.dataset.filter);
            });
        });

        // Add ingredient button
        document.getElementById('addIngredientBtn').addEventListener('click', () => {
            this.addIngredientField();
        });

        // Add step button
        document.getElementById('addStepBtn').addEventListener('click', () => {
            this.addStepField();
        });

        // Servings controls
        document.getElementById('decreaseServings').addEventListener('click', () => {
            this.adjustServings(-1);
        });

        document.getElementById('increaseServings').addEventListener('click', () => {
            this.adjustServings(1);
        });

        document.getElementById('servingsInput').addEventListener('change', (e) => {
            this.adjustServings(0, parseInt(e.target.value));
        });

        // Parse recipe from URL button
        document.getElementById('parseBtn').addEventListener('click', () => {
            this.parseRecipeFromUrl();
        });
    }

    // Parse recipe from URL
    async parseRecipeFromUrl() {
        const urlInput = document.getElementById('recipeUrl');
        const parseBtn = document.getElementById('parseBtn');
        const url = urlInput.value.trim();

        if (!url) {
            this.showToast('Пожалуйста, введите URL рецепта', 'warning');
            return;
        }

        // Validate URL
        try {
            new URL(url);
        } catch (error) {
            this.showToast('Некорректный URL', 'error');
            return;
        }

        // Show loading state
        parseBtn.disabled = true;
        parseBtn.classList.add('loading');
        parseBtn.innerHTML = '<span>🔄</span><span>Загрузка...</span>';

        console.log('Starting to parse recipe from:', url);

        try {
            // Parse recipe using RecipeParser
            const recipeData = await this.recipeParser.parseFromUrl(url);

            console.log('Recipe data received:', recipeData);

            // Check if we got any data
            if (!recipeData.name && !recipeData.description && recipeData.ingredients.length === 0) {
                throw new Error('Не удалось извлечь данные рецепта. Возможно, сайт не поддерживается.');
            }

            // Fill form with parsed data
            if (recipeData.name) {
                document.getElementById('recipeName').value = recipeData.name;
                console.log('Filled name:', recipeData.name);
            }

            if (recipeData.description) {
                document.getElementById('recipeDescription').value = recipeData.description;
                console.log('Filled description');
            }

            if (recipeData.cookingTime) {
                document.getElementById('cookingTime').value = recipeData.cookingTime;
                console.log('Filled cooking time:', recipeData.cookingTime);
            }

            if (recipeData.servings) {
                document.getElementById('servings').value = recipeData.servings;
                console.log('Filled servings:', recipeData.servings);
            }

            if (recipeData.imageUrl) {
                document.getElementById('imageUrl').value = recipeData.imageUrl;
                console.log('Filled image URL');
            }

            // Fill ingredients
            if (recipeData.ingredients && recipeData.ingredients.length > 0) {
                const ingredientsContainer = document.getElementById('ingredientsContainer');
                ingredientsContainer.innerHTML = '';
                recipeData.ingredients.forEach(ing => {
                    this.addIngredientField(ing.name, ing.quantity);
                });
                console.log('Filled ingredients:', recipeData.ingredients.length);
            }

            // Fill steps
            if (recipeData.steps && recipeData.steps.length > 0) {
                const stepsContainer = document.getElementById('stepsContainer');
                stepsContainer.innerHTML = '';
                recipeData.steps.forEach(step => {
                    this.addStepField(step.text, step.image);
                });
                console.log('Filled steps:', recipeData.steps.length);
            }

            this.showToast(`Рецепт успешно загружен! ${recipeData.ingredients.length} ингредиентов, ${recipeData.steps.length} шагов ✅`, 'success');
        } catch (error) {
            console.error('Error parsing recipe:', error);
            let errorMessage = 'Не удалось загрузить рецепт. ';
            
            if (error.message.includes('timeout') || error.message.includes('время')) {
                errorMessage += 'Превышено время ожидания. Попробуйте другой сайт.';
            } else if (error.message.includes('CORS') || error.message.includes('загрузить страницу')) {
                errorMessage += 'Сайт блокирует доступ. Попробуйте другой сайт.';
            } else if (error.message.includes('извлечь данные')) {
                errorMessage += 'Сайт не поддерживается или структура изменилась.';
            } else {
                errorMessage += 'Проверьте URL и попробуйте снова.';
            }
            
            this.showToast(errorMessage, 'error');
        } finally {
            // Reset button state
            parseBtn.disabled = false;
            parseBtn.classList.remove('loading');
            parseBtn.innerHTML = '<span>🔄</span><span>Парсить</span>';
        }
    }

    // Adjust servings and recalculate ingredients
    adjustServings(delta, newValue = null) {
        const input = document.getElementById('servingsInput');
        let currentServings = newValue !== null ? newValue : parseInt(input.value) || 1;

        currentServings = Math.max(1, Math.min(50, currentServings + delta));
        input.value = currentServings;

        // Update servings display
        document.getElementById('detailServings').textContent = `👥 ${currentServings} порций`;

        // Recalculate ingredients
        const recipe = this.recipes.find(r => String(r.id) === String(this.currentRecipeId));
        if (recipe && recipe.ingredients) {
            this.renderIngredients(recipe.ingredients, currentServings);
        }
    }

    // Render ingredients with adjusted quantities
    renderIngredients(ingredients, servings) {
        const list = document.getElementById('detailIngredientsList');
        const ratio = servings / this.originalServings;

        list.innerHTML = ingredients.map(ing => {
            let adjustedQuantity = ing.quantity || '';

            if (adjustedQuantity && ratio !== 1) {
                // Try to parse and adjust quantity
                const parsed = this.parseQuantity(adjustedQuantity);
                if (parsed) {
                    adjustedQuantity = this.formatQuantity(parsed.value * ratio, parsed.unit);
                }
            }

            const quantityHtml = adjustedQuantity ? ` — ${this.escapeHtml(adjustedQuantity)}` : '';
            return `<li><strong>${this.escapeHtml(ing.name)}</strong>${quantityHtml}</li>`;
        }).join('');
    }

    // Parse quantity into value and unit
    parseQuantity(quantity) {
        const match = quantity.match(/^([\d.,]+)\s*(.*)?$/);
        if (match) {
            return {
                value: parseFloat(match[1]),
                unit: match[2] || ''
            };
        }
        return null;
    }

    // Format quantity with unit
    formatQuantity(value, unit) {
        // Round to reasonable precision
        const rounded = Math.round(value * 100) / 100;
        return unit ? `${rounded} ${unit}` : `${rounded}`;
    }

    // Add ingredient field
    addIngredientField(name = '', quantity = '') {
        const container = document.getElementById('ingredientsContainer');
        const item = document.createElement('div');
        item.className = 'ingredient-item';
        item.innerHTML = `
            <input type="text" class="form-input ingredient-name" placeholder="Название ингредиента" value="${this.escapeHtml(name)}">
            <input type="text" class="form-input ingredient-quantity" placeholder="Количество" value="${this.escapeHtml(quantity)}">
            <button type="button" class="remove-ingredient-btn">✕</button>
        `;
        container.appendChild(item);

        // Add remove button handler
        item.querySelector('.remove-ingredient-btn').addEventListener('click', () => {
            item.remove();
            this.updateRemoveButtons();
        });

        this.updateRemoveButtons();
    }

    // Add step field
    addStepField(text = '', image = '') {
        const container = document.getElementById('stepsContainer');
        const stepNumber = container.children.length + 1;
        const item = document.createElement('div');
        item.className = 'step-item';
        item.innerHTML = `
            <div class="step-number">${stepNumber}</div>
            <div class="step-content">
                <textarea class="form-textarea step-text" rows="2" placeholder="Опишите шаг приготовления...">${this.escapeHtml(text)}</textarea>
                <input type="url" class="form-input step-image" placeholder="URL фото шага (необязательно)" value="${this.escapeHtml(image)}">
            </div>
            <button type="button" class="remove-step-btn">✕</button>
        `;
        container.appendChild(item);

        // Add remove button handler
        item.querySelector('.remove-step-btn').addEventListener('click', () => {
            item.remove();
            this.updateStepNumbers();
        });
    }

    // Update remove buttons visibility
    updateRemoveButtons() {
        const items = document.querySelectorAll('.ingredient-item');
        items.forEach((item, index) => {
            const btn = item.querySelector('.remove-ingredient-btn');
            btn.style.display = items.length > 1 ? 'block' : 'none';
        });
    }

    // Update step numbers
    updateStepNumbers() {
        const items = document.querySelectorAll('.step-item');
        items.forEach((item, index) => {
            const number = item.querySelector('.step-number');
            const btn = item.querySelector('.remove-step-btn');
            number.textContent = index + 1;
            btn.style.display = items.length > 1 ? 'block' : 'none';
        });
    }

    // Open modal
    openModal() {
        this.editingId = null;
        document.querySelector('.modal-title').textContent = 'Добавить рецепт';
        document.querySelector('.submit-btn .btn-text').textContent = 'Сохранить рецепт';

        // Reset form
        document.getElementById('recipeForm').reset();

        // Reset ingredients
        const ingredientsContainer = document.getElementById('ingredientsContainer');
        ingredientsContainer.innerHTML = '';
        this.addIngredientField();

        // Reset steps
        const stepsContainer = document.getElementById('stepsContainer');
        stepsContainer.innerHTML = '';
        this.addStepField();

        document.getElementById('modal').classList.add('active');
        document.body.style.overflow = 'hidden';
        document.getElementById('recipeName').focus();
    }

    // Open modal for editing
    openEditModal(id) {
        const recipe = this.recipes.find(r => String(r.id) === String(id));
        if (!recipe) return;

        this.editingId = id;
        document.querySelector('.modal-title').textContent = 'Редактировать рецепт';
        document.querySelector('.submit-btn .btn-text').textContent = 'Обновить рецепт';

        // Fill form with recipe data
        document.getElementById('recipeName').value = recipe.name;
        document.getElementById('mealType').value = recipe.mealType;
        document.getElementById('recipeUrl').value = recipe.url;
        document.getElementById('recipeDescription').value = recipe.description || '';
        document.getElementById('cookingTime').value = recipe.cookingTime || '';
        document.getElementById('imageUrl').value = recipe.imageUrl || '';
        document.getElementById('servings').value = recipe.servings || '';
        document.getElementById('videoUrl').value = recipe.videoUrl || '';

        // Fill ingredients
        const ingredientsContainer = document.getElementById('ingredientsContainer');
        ingredientsContainer.innerHTML = '';
        if (recipe.ingredients && recipe.ingredients.length > 0) {
            recipe.ingredients.forEach(ing => {
                this.addIngredientField(ing.name, ing.quantity);
            });
        } else {
            this.addIngredientField();
        }

        // Fill steps
        const stepsContainer = document.getElementById('stepsContainer');
        stepsContainer.innerHTML = '';
        if (recipe.steps && recipe.steps.length > 0) {
            recipe.steps.forEach(step => {
                // Handle both old format (string) and new format (object with text and image)
                const stepText = typeof step === 'string' ? step : step.text;
                const stepImage = typeof step === 'object' && step.image ? step.image : '';
                this.addStepField(stepText, stepImage);
            });
        } else {
            this.addStepField();
        }

        document.getElementById('modal').classList.add('active');
        document.getElementById('recipeName').focus();
    }

    // Close modal
    closeModal() {
        document.getElementById('modal').classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('recipeForm').reset();

        // Reset ingredients
        const ingredientsContainer = document.getElementById('ingredientsContainer');
        ingredientsContainer.innerHTML = '';
        this.addIngredientField();

        // Reset steps
        const stepsContainer = document.getElementById('stepsContainer');
        stepsContainer.innerHTML = '';
        this.addStepField();

        this.editingId = null;
    }

    // Add new recipe or update existing
    async addRecipe() {
        const name = document.getElementById('recipeName').value.trim();
        const mealType = document.getElementById('mealType').value;
        const url = document.getElementById('recipeUrl').value.trim();
        const description = document.getElementById('recipeDescription').value.trim();
        const cookingTime = document.getElementById('cookingTime').value.trim();
        const imageUrl = document.getElementById('imageUrl').value.trim();
        const servings = document.getElementById('servings').value.trim();
        const videoUrl = document.getElementById('videoUrl').value.trim();

        // Collect ingredients
        const ingredients = [];
        document.querySelectorAll('.ingredient-item').forEach(item => {
            const name = item.querySelector('.ingredient-name').value.trim();
            const quantity = item.querySelector('.ingredient-quantity').value.trim();
            if (name) {
                ingredients.push({ name, quantity });
            }
        });

        // Collect steps
        const steps = [];
        document.querySelectorAll('.step-item').forEach(item => {
            const text = item.querySelector('.step-text').value.trim();
            const image = item.querySelector('.step-image').value.trim();
            if (text) {
                steps.push({ text, image });
            }
        });

        if (this.editingId) {
            // Update existing recipe
            const recipeIndex = this.recipes.findIndex(r => String(r.id) === String(this.editingId));
            if (recipeIndex !== -1) {
                this.recipes[recipeIndex] = {
                    ...this.recipes[recipeIndex],
                    name,
                    mealType,
                    url,
                    description,
                    cookingTime,
                    imageUrl,
                    servings,
                    videoUrl,
                    ingredients,
                    steps,
                    updatedAt: new Date().toISOString()
                };
                // Save in background
                this.saveRecipes();
                this.renderRecipes();
                this.closeModal();
                this.showToast('Рецепт успешно обновлен! ✏️');
            }
        } else {
            // Add new recipe
            const recipe = {
                id: Date.now(),
                name,
                mealType,
                url,
                description,
                cookingTime,
                imageUrl,
                servings,
                videoUrl,
                ingredients,
                steps,
                favorite: false,
                createdAt: new Date().toISOString()
            };

            this.recipes.unshift(recipe);
            // Save in background
            this.saveRecipes();
            this.renderRecipes();
            this.closeModal();
            this.showToast('Рецепт успешно добавлен! 🎉');
        }
    }

    // Delete recipe
    async deleteRecipe(id) {
        this.recipeToDelete = id;
        const deleteModal = document.getElementById('deleteModal');
        deleteModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Confirm delete
    confirmDelete() {
        if (this.recipeToDelete) {
            // Delete from Firebase in background
            if (useFirebase && db) {
                db.collection('recipes').doc(this.recipeToDelete).delete()
                    .catch(error => console.error('Error deleting from Firebase:', error));
            }
            // Remove from array and save to localStorage
            this.recipes = this.recipes.filter(r => String(r.id) !== String(this.recipeToDelete));
            this.saveRecipes();
            this.renderRecipes();
            this.showToast('Рецепт удален 🗑️');
            this.closeDeleteModal();
        }
    }

    // Close delete modal
    closeDeleteModal() {
        const deleteModal = document.getElementById('deleteModal');
        deleteModal.classList.remove('active');
        document.body.style.overflow = '';
        this.recipeToDelete = null;
    }

    // Open recipe detail modal
    openDetailModal(id) {
        const recipe = this.recipes.find(r => String(r.id) === String(id));
        if (!recipe) return;

        // Store current recipe ID and original servings for calculation
        this.currentRecipeId = id;
        this.originalServings = recipe.servings || 4;

        // Fill modal with recipe data
        document.getElementById('detailTitle').textContent = recipe.name;
        document.getElementById('detailType').textContent = this.getMealTypeLabel(recipe.mealType);
        document.getElementById('detailTime').textContent = recipe.cookingTime ? `⏱️ ${recipe.cookingTime}` : '';
        document.getElementById('detailServings').textContent = recipe.servings ? `👥 ${recipe.servings} порций` : '';
        document.getElementById('detailDescription').textContent = recipe.description || 'Описание отсутствует';
        document.getElementById('detailUrl').href = recipe.url;

        // Set servings input value
        const servingsInput = document.getElementById('servingsInput');
        servingsInput.value = this.originalServings;

        // Handle image
        const detailImage = document.getElementById('detailImage');
        if (recipe.imageUrl) {
            detailImage.innerHTML = `<img src="${this.escapeHtml(recipe.imageUrl)}" alt="${this.escapeHtml(recipe.name)}" onerror="this.parentElement.innerHTML='<span class=\\'recipe-emoji\\'>${this.getMealTypeEmoji(recipe.mealType)}</span>'">`;
        } else {
            detailImage.innerHTML = `<span class="recipe-emoji">${this.getMealTypeEmoji(recipe.mealType)}</span>`;
        }

        // Handle ingredients
        const detailIngredients = document.getElementById('detailIngredients');
        const detailIngredientsList = document.getElementById('detailIngredientsList');
        if (recipe.ingredients && recipe.ingredients.length > 0) {
            detailIngredients.style.display = 'block';
            this.renderIngredients(recipe.ingredients, this.originalServings);
        } else {
            detailIngredients.style.display = 'none';
        }

        // Handle steps
        const detailSteps = document.getElementById('detailSteps');
        const detailStepsList = document.getElementById('detailStepsList');
        if (recipe.steps && recipe.steps.length > 0) {
            detailSteps.style.display = 'block';
            detailStepsList.innerHTML = recipe.steps.map((step, index) => {
                // Handle both old format (string) and new format (object with text and image)
                const stepText = typeof step === 'string' ? step : step.text;
                const stepImage = typeof step === 'object' && step.image ? step.image : '';
                const imageHtml = stepImage ? `
                    <div class="detail-step-image">
                        <img src="${this.escapeHtml(stepImage)}" alt="Шаг ${index + 1}" onerror="this.style.display='none'">
                    </div>
                ` : '';
                return `
                    <div class="detail-step">
                        <div class="detail-step-number">${index + 1}</div>
                        <div class="detail-step-content">
                            <div class="detail-step-text">${this.escapeHtml(stepText)}</div>
                            ${imageHtml}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            detailSteps.style.display = 'none';
        }

        // Handle video
        const detailVideo = document.getElementById('detailVideo');
        const videoPreview = document.getElementById('videoPreview');
        if (recipe.videoUrl) {
            detailVideo.style.display = 'block';

            // Try to get YouTube video ID and create embed
            const youtubeMatch = recipe.videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
            if (youtubeMatch) {
                const videoId = youtubeMatch[1];
                videoPreview.innerHTML = `
                    <iframe
                        src="https://www.youtube.com/embed/${videoId}"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        class="video-iframe">
                    </iframe>
                `;
            } else {
                // For other video platforms, show placeholder
                videoPreview.innerHTML = `
                    <div class="video-preview-placeholder">
                        <span class="video-preview-icon">▶️</span>
                        <span class="video-preview-text">Откройте ссылку на видео</span>
                    </div>
                `;
            }
        } else {
            detailVideo.style.display = 'none';
        }

        // Show modal
        document.getElementById('recipeDetailModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Close recipe detail modal
    closeDetailModal() {
        document.getElementById('recipeDetailModal').classList.remove('active');
        document.body.style.overflow = '';
    }

    // Toggle favorite
    async toggleFavorite(id) {
        const recipe = this.recipes.find(r => String(r.id) === String(id));
        if (recipe) {
            recipe.favorite = !recipe.favorite;
            
            // Update button immediately without re-rendering
            const btn = document.querySelector(`.favorite-btn[data-id="${id}"]`);
            if (btn) {
                btn.classList.toggle('active', recipe.favorite);
            }
            
            // Show toast immediately
            this.showToast(recipe.favorite ? 'Добавлено в избранное ❤️' : 'Удалено из избранного 💔');
            
            // Save in background
            if (useFirebase && db) {
                try {
                    const { id: recipeId, ...recipeData } = recipe;
                    await db.collection('recipes').doc(id).set(recipeData);
                } catch (error) {
                    console.error('Error updating favorite in Firebase:', error);
                }
            }
            
            await this.saveRecipes();
        }
    }

    // Set filter
    setFilter(filter) {
        const previousFilter = this.currentFilter;
        this.currentFilter = filter;

        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        // Update mobile navigation
        document.querySelectorAll('.mobile-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.filter === filter);
        });

        // Handle different views
        const recipeGrid = document.getElementById('recipeGrid');
        const menuPlanner = document.getElementById('menuPlanner');
        const shoppingList = document.getElementById('shoppingList');
        const emptyState = document.getElementById('emptyState');
        const filterTabs = document.querySelector('.filter-tabs');
        const mobileNav = document.getElementById('mobileNav');

        // Check if we're switching between recipe filters or from/to planner/shopping
        const isRecipeFilter = ['all', 'first', 'second', 'salads', 'snacks', 'baking', 'dessert', 'favorites'].includes(filter);
        const wasRecipeFilter = ['all', 'first', 'second', 'salads', 'snacks', 'baking', 'dessert', 'favorites'].includes(previousFilter);

        if (filter === 'planner') {
            recipeGrid.style.display = 'none';
            emptyState.style.display = 'none';
            menuPlanner.style.display = 'block';
            shoppingList.style.display = 'none';
            // Hide navigation
            filterTabs.classList.add('hidden');
            mobileNav.classList.add('hidden');
            if (!this.menuPlanner) {
                this.menuPlanner = new MenuPlanner(this);
            }
        } else if (filter === 'shopping') {
            recipeGrid.style.display = 'none';
            emptyState.style.display = 'none';
            menuPlanner.style.display = 'none';
            shoppingList.style.display = 'block';
            // Hide navigation
            filterTabs.classList.add('hidden');
            mobileNav.classList.add('hidden');
            if (!this.shoppingList) {
                this.shoppingList = new ShoppingList(this);
            } else {
                this.shoppingList.renderItems();
            }
        } else {
            recipeGrid.style.display = 'grid';
            menuPlanner.style.display = 'none';
            shoppingList.style.display = 'none';
            // Show navigation only if we were in planner or shopping
            if (!wasRecipeFilter) {
                filterTabs.classList.remove('hidden');
                mobileNav.classList.remove('hidden');
            }
            this.renderRecipes();
        }
    }

    // Get filtered recipes
    getFilteredRecipes() {
        let filtered = [...this.recipes];

        // Apply search filter (only by name, matching word beginnings)
        if (this.searchQuery) {
            filtered = filtered.filter(recipe =>
                recipe.name.toLowerCase().split(' ').some(word => word.startsWith(this.searchQuery))
            );
        }

        // Apply category filter
        if (this.currentFilter === 'favorites') {
            filtered = filtered.filter(recipe => recipe.favorite);
        } else if (this.currentFilter !== 'all') {
            filtered = filtered.filter(recipe => recipe.mealType === this.currentFilter);
        }

        return filtered;
    }

    // Get meal type label
    getMealTypeLabel(type) {
        const labels = {
            first: '🍲 Первое блюдо',
            second: '🍝 Второе блюдо',
            salads: '🥗 Салат',
            dessert: '🍰 Десерт',
            snacks: '🍢 Закуска',
            baking: '🥐 Выпечка'
        };
        return labels[type] || '🍽️';
    }

    // Get default emoji for meal type
    getMealTypeEmoji(type) {
        const emojis = {
            first: '🍲',
            second: '🍝',
            salads: '🥗',
            dessert: '🍰',
            snacks: '🍢',
            baking: '🥐'
        };
        return emojis[type] || '🍽️';
    }

    // Render recipes
    renderRecipes() {
        const grid = document.getElementById('recipeGrid');
        const emptyState = document.getElementById('emptyState');
        const filtered = this.getFilteredRecipes();

        if (filtered.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        grid.innerHTML = filtered.map((recipe, index) => this.createRecipeCard(recipe, index)).join('');

        // Bind card events
        this.bindCardEvents();
    }

    // Create recipe card HTML
    createRecipeCard(recipe, index) {
        const imageHtml = recipe.imageUrl 
            ? `<img src="${this.escapeHtml(recipe.imageUrl)}" alt="${this.escapeHtml(recipe.name)}" onerror="this.parentElement.innerHTML='<span class=\\'recipe-emoji\\'>${this.getMealTypeEmoji(recipe.mealType)}</span>'">`
            : `<span class="recipe-emoji">${this.getMealTypeEmoji(recipe.mealType)}</span>`;

        const timeHtml = recipe.cookingTime 
            ? `<div class="recipe-time">
                <span>⏱️</span>
                <span>${this.escapeHtml(recipe.cookingTime)}</span>
               </div>`
            : '';

        const descriptionHtml = recipe.description
            ? `<p class="recipe-description">${this.escapeHtml(recipe.description)}</p>`
            : '';

        const videoHtml = recipe.videoUrl
            ? `<div class="recipe-video-badge">
                <svg class="youtube-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>Видео</span>
               </div>`
            : '';

        return `
            <div class="recipe-card" style="animation-delay: ${index * 0.05}s" data-id="${recipe.id}">
                <div class="recipe-image">
                    ${imageHtml}
                    ${videoHtml}
                </div>
                <div class="recipe-content">
                    <div class="recipe-header">
                        <h3 class="recipe-title">${this.escapeHtml(recipe.name)}</h3>
                        <span class="recipe-type ${recipe.mealType}">${this.getMealTypeLabel(recipe.mealType)}</span>
                    </div>
                    ${descriptionHtml}
                    <div class="recipe-actions">
                        <div class="recipe-actions-main">
                            ${timeHtml}
                            <button class="recipe-btn primary" data-action="open-recipe" data-url="${this.escapeHtml(recipe.url)}">
                                <span>🍽️</span>
                                <span>Открыть</span>
                            </button>
                        </div>
                        <button class="edit-btn" data-action="edit" data-id="${recipe.id}" title="Редактировать">
                            <span>✏️</span>
                        </button>
                        <button class="favorite-btn ${recipe.favorite ? 'active' : ''}" data-action="favorite" data-id="${recipe.id}"></button>
                        <button class="delete-btn" data-action="delete" data-id="${recipe.id}" title="Удалить">
                            <span>🗑️</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Bind card events
    bindCardEvents() {
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.openEditModal(id);
            });
        });

        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.toggleFavorite(id);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.deleteRecipe(id);
            });
        });

        // Prevent detail modal from opening when clicking "Open" button
        document.querySelectorAll('.recipe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('.recipe-card').dataset.id;
                this.openDetailModal(id);  // Открывает модальное окно с деталями
            });
        });

        // Card click to open detail modal
        document.querySelectorAll('.recipe-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                this.openDetailModal(id);
            });
        });
    }

    // Show toast notification
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon');

        // Remove all type classes
        toast.classList.remove('success', 'error', 'info', 'warning');

        // Add type class
        toast.classList.add(type);

        // Update icon based on type
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        toastIcon.textContent = icons[type] || icons.success;

        toastMessage.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Particles Animation
class ParticlesAnimation {
    constructor() {
        this.canvas = document.getElementById('particlesCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 50;
        this.colors = ['#ff6b9d', '#a855f7', '#fbbf24', '#34d399', '#60a5fa'];
        this.foodEmojis = ['🍳', '🍰', '🍝', '🥗', '🍲', '🥞', '🍕', '🍔', '🌮', '🍜'];
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.createParticles();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 20 + 10,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5,
                opacity: Math.random() * 0.5 + 0.1,
                emoji: this.foodEmojis[Math.floor(Math.random() * this.foodEmojis.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(particle => {
            // Update position
            particle.x += particle.speedX;
            particle.y += particle.speedY;
            particle.rotation += particle.rotationSpeed;

            // Wrap around edges
            if (particle.x < -particle.size) particle.x = this.canvas.width + particle.size;
            if (particle.x > this.canvas.width + particle.size) particle.x = -particle.size;
            if (particle.y < -particle.size) particle.y = this.canvas.height + particle.size;
            if (particle.y > this.canvas.height + particle.size) particle.y = -particle.size;

            // Draw particle
            this.ctx.save();
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate(particle.rotation);
            this.ctx.globalAlpha = particle.opacity;
            this.ctx.font = `${particle.size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(particle.emoji, 0, 0);
            this.ctx.restore();
        });

        requestAnimationFrame(() => this.animate());
    }
}

// Parallax Effect
class ParallaxEffect {
    constructor() {
        this.header = document.querySelector('.header');
        this.title = document.querySelector('.title');
        this.recipeCards = document.querySelectorAll('.recipe-card');
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => this.handleScroll());
        // Initial call
        this.handleScroll();
    }

    handleScroll() {
        const scrollY = window.scrollY;

        // Parallax for header
        if (this.header) {
            const headerOffset = scrollY * 0.3;
            this.header.style.transform = `translateY(${headerOffset}px)`;
            this.header.style.opacity = Math.max(0, 1 - scrollY / 400);
        }

        // Parallax for title icons
        if (this.title) {
            const icons = this.title.querySelectorAll('.title-icon');
            icons.forEach((icon, index) => {
                const direction = index === 0 ? -1 : 1;
                const iconOffset = scrollY * 0.1 * direction;
                icon.style.transform = `translateY(${iconOffset}px) rotate(${scrollY * 0.05}deg)`;
            });
        }

        // Parallax for recipe cards
        this.recipeCards.forEach((card, index) => {
            const cardTop = card.getBoundingClientRect().top;
            const cardHeight = card.offsetHeight;
            const windowHeight = window.innerHeight;

            if (cardTop < windowHeight && cardTop > -cardHeight) {
                const cardOffset = (windowHeight - cardTop) * 0.02;
                const rotation = (windowHeight - cardTop) * 0.01;
                card.style.transform = `translateY(${cardOffset}px) rotateX(${rotation}deg)`;
            }
        });
    }
}

// Ripple Effect for buttons
// Menu Planner Class
class MenuPlanner {
    constructor(recipeBook) {
        this.recipeBook = recipeBook;
        this.days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
        this.mealTypes = ['breakfast', 'lunch', 'dinner'];
        this.mealLabels = {
            breakfast: '🌅 Завтрак',
            lunch: '☀️ Обед',
            dinner: '🌙 Ужин'
        };
        this.menu = {};
        this.unsubscribe = null; // Для отписки от слушателя Firebase
        this.init();
    }

    async init() {
        await this.loadMenu();
        this.renderWeek();
        this.bindEvents();
        this.setupRealtimeSync();
    }

    // Load menu from Firebase or localStorage
    async loadMenu() {
        if (useFirebase && db && window.authManager && window.authManager.currentUser) {
            try {
                const userId = window.authManager.currentUser.uid;
                const doc = await db.collection('users').doc(userId).collection('data').doc('weeklyMenu').get();
                
                if (doc.exists && doc.data()) {
                    this.menu = doc.data().items || {};
                    console.log('Menu loaded from Firebase for user:', Object.keys(this.menu).length, 'meals');
                } else {
                    this.loadFromLocalStorage();
                }
            } catch (error) {
                console.error('Error loading menu from Firebase:', error);
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
        }
    }

    // Load from localStorage as fallback
    loadFromLocalStorage() {
        const saved = localStorage.getItem('weeklyMenu');
        this.menu = saved ? JSON.parse(saved) : {};
        console.log('Menu loaded from localStorage:', Object.keys(this.menu).length, 'meals');
    }

    // Save menu to Firebase and localStorage
    async saveMenu() {
        // Always save to localStorage first (fast)
        this.saveToLocalStorage();

        // Then save to Firebase in background (async)
        if (useFirebase && db && window.authManager && window.authManager.currentUser) {
            try {
                const userId = window.authManager.currentUser.uid;
                await db.collection('users').doc(userId).collection('data').doc('weeklyMenu').set({
                    items: this.menu,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('Menu saved to Firebase for user:', userId);
            } catch (error) {
                console.error('Error saving menu to Firebase:', error);
            }
        }
    }

    // Save to localStorage as fallback
    saveToLocalStorage() {
        localStorage.setItem('weeklyMenu', JSON.stringify(this.menu));
        console.log('Menu saved to localStorage');
    }

    // Setup real-time sync with Firebase
    setupRealtimeSync() {
        if (useFirebase && db && window.authManager && window.authManager.currentUser) {
            // Unsubscribe from previous listener if exists
            if (this.unsubscribe) {
                this.unsubscribe();
            }

            const userId = window.authManager.currentUser.uid;
            
            // Listen for real-time changes
            this.unsubscribe = db.collection('users').doc(userId).collection('data').doc('weeklyMenu')
                .onSnapshot((doc) => {
                    if (doc.exists && doc.data()) {
                        const data = doc.data();
                        if (data.items) {
                            this.menu = data.items;
                            this.saveToLocalStorage();
                            this.renderWeek();
                            console.log('Real-time sync: menu updated from Firebase');
                        }
                    }
                }, (error) => {
                    console.error('Error listening to menu changes:', error);
                });

            console.log('Real-time sync enabled for menu');
        }
    }

    // Cleanup when destroying instance
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    renderWeek() {
        const weekGrid = document.getElementById('weekGrid');
        const today = new Date();

        weekGrid.innerHTML = Array.from({ length: 7 }, (_, offset) => {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + offset);

            const dayIndex = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const dayNameIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Convert to 0-6 (Monday-Sunday)
            const dayName = this.days[dayNameIndex];
            const dayKey = `day_${offset}`; // Use offset as key (0-6 for next 7 days)
            const isToday = offset === 0;
            const dateStr = targetDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

            return `
                <div class="day-card ${isToday ? 'today' : ''}" data-day="${offset}">
                    <div class="day-header">
                        <span class="day-name">${dayName}</span>
                        <span class="day-date">${dateStr}</span>
                    </div>
                    <div class="day-meals">
                        ${this.mealTypes.map(mealType => this.renderMealSlot(dayKey, mealType)).join('')}
                    </div>
                </div>
            `;
        }).join('');

        this.bindMealSlotEvents();
    }

    getDateForDay(dayIndex) {
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + dayIndex);
        return targetDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }

    renderMealSlot(dayKey, mealType) {
        const slotKey = `${dayKey}_${mealType}`;
        const meal = this.menu[slotKey];

        if (meal) {
            return `
                <div class="meal-slot filled" data-slot="${slotKey}">
                    <span class="meal-name">${this.escapeHtml(meal.name)}</span>
                    <button class="meal-remove" data-slot="${slotKey}" title="Удалить">✕</button>
                </div>
            `;
        }

        return `
            <div class="meal-slot" data-slot="${slotKey}">
                <span class="meal-label">${this.mealLabels[mealType]}</span>
            </div>
        `;
    }

    bindMealSlotEvents() {
        document.querySelectorAll('.meal-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                if (e.target.classList.contains('meal-remove')) {
                    e.stopPropagation();
                    this.removeMeal(e.target.dataset.slot);
                } else {
                    this.openRecipeSelector(slot.dataset.slot);
                }
            });
        });
    }

    openRecipeSelector(slotKey) {
        this.currentSlot = slotKey;
        const parts = slotKey.split('_');
        const dayOffset = parseInt(parts[1]);
        const mealType = parts[2];

        // Get the actual day name based on offset
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + dayOffset);
        const dayIndex = targetDate.getDay();
        const dayNameIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        const dayName = this.days[dayNameIndex];
        const mealLabel = this.mealLabels[mealType];

        // Create a simple modal for recipe selection
        const modalHtml = `
            <div class="modal" id="recipeSelectorModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Выберите рецепт</h2>
                        <button class="close-btn" id="closeRecipeSelector">&times;</button>
                    </div>
                    <p style="margin-bottom: 20px; color: var(--text-secondary);">${dayName} - ${mealLabel}</p>
                    <div class="recipe-selector-list">
                        ${this.recipeBook.recipes.map(recipe => `
                            <div class="recipe-selector-item" data-recipe-id="${recipe.id}">
                                <span class="recipe-selector-emoji">${this.recipeBook.getMealTypeEmoji(recipe.mealType)}</span>
                                <div class="recipe-selector-info">
                                    <div class="recipe-selector-name">${this.escapeHtml(recipe.name)}</div>
                                    <div class="recipe-selector-type">${this.recipeBook.getMealTypeLabel(recipe.mealType)}</div>
                                </div>
                            </div>
                        `).join('')}
                        ${this.recipeBook.recipes.length === 0 ? '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Нет доступных рецептов</p>' : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.style.overflow = 'hidden';

        // Show modal with a small delay to ensure it's rendered
        setTimeout(() => {
            const modal = document.getElementById('recipeSelectorModal');
            if (modal) {
                modal.classList.add('active');
            }
        }, 10);

        // Bind close button
        const closeBtn = document.getElementById('closeRecipeSelector');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeRecipeSelector();
            });
        }

        // Bind backdrop click
        const modal = document.getElementById('recipeSelectorModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'recipeSelectorModal') {
                    this.closeRecipeSelector();
                }
            });
        }

        // Bind recipe item clicks
        document.querySelectorAll('.recipe-selector-item').forEach(item => {
            item.addEventListener('click', () => {
                const recipeId = item.dataset.recipeId;
                const recipe = this.recipeBook.recipes.find(r => String(r.id) === recipeId);
                if (recipe) {
                    this.addMeal(this.currentSlot, recipe);
                }
                this.closeRecipeSelector();
            });
        });
    }

    closeRecipeSelector() {
        const modal = document.getElementById('recipeSelectorModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                document.body.style.overflow = '';
            }, 300);
        }
    }

    addMeal(slotKey, recipe) {
        this.menu[slotKey] = {
            id: recipe.id,
            name: recipe.name,
            mealType: recipe.mealType
        };
        this.saveMenu();
        this.renderWeek();
        this.recipeBook.showToast(`Рецепт добавлен в меню! 📅`);
    }

    removeMeal(slotKey) {
        delete this.menu[slotKey];
        this.saveMenu();
        this.renderWeek();
        this.recipeBook.showToast('Рецепт удален из меню 🗑️');
    }

    bindEvents() {
        document.getElementById('generateShoppingListBtn').addEventListener('click', () => {
            this.generateShoppingList();
        });
    }

    generateShoppingList() {
        const shoppingList = new ShoppingList(this.recipeBook);
        shoppingList.generateFromMenu(this.menu);
        this.recipeBook.setFilter('shopping');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Shopping List Class
class ShoppingList {
    constructor(recipeBook) {
        this.recipeBook = recipeBook;
        this.items = [];
        this.unsubscribe = null; // Для отписки от слушателя Firebase
        this.init();
    }

    async init() {
        await this.loadItems();
        this.renderItems();
        this.bindEvents();
        this.setupRealtimeSync();
    }

    // Load items from Firebase or localStorage
    async loadItems() {
        if (useFirebase && db && window.authManager && window.authManager.currentUser) {
            try {
                const userId = window.authManager.currentUser.uid;
                const doc = await db.collection('users').doc(userId).collection('data').doc('shoppingList').get();
                
                if (doc.exists && doc.data()) {
                    this.items = doc.data().items || [];
                    console.log('Shopping list loaded from Firebase for user:', this.items.length);
                } else {
                    this.loadFromLocalStorage();
                }
            } catch (error) {
                console.error('Error loading shopping list from Firebase:', error);
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
        }
    }

    // Load from localStorage as fallback
    loadFromLocalStorage() {
        const saved = localStorage.getItem('shoppingList');
        this.items = saved ? JSON.parse(saved) : [];
        console.log('Shopping list loaded from localStorage:', this.items.length);
    }

    // Save items to Firebase and localStorage
    async saveItems() {
        // Always save to localStorage first (fast)
        this.saveToLocalStorage();

        // Then save to Firebase in background (async)
        if (useFirebase && db && window.authManager && window.authManager.currentUser) {
            try {
                const userId = window.authManager.currentUser.uid;
                await db.collection('users').doc(userId).collection('data').doc('shoppingList').set({
                    items: this.items,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('Shopping list saved to Firebase for user:', userId);
            } catch (error) {
                console.error('Error saving shopping list to Firebase:', error);
            }
        }
    }

    // Save to localStorage as fallback
    saveToLocalStorage() {
        localStorage.setItem('shoppingList', JSON.stringify(this.items));
        console.log('Shopping list saved to localStorage');
    }

    // Setup real-time sync with Firebase
    setupRealtimeSync() {
        if (useFirebase && db && window.authManager && window.authManager.currentUser) {
            // Unsubscribe from previous listener if exists
            if (this.unsubscribe) {
                this.unsubscribe();
            }

            const userId = window.authManager.currentUser.uid;
            
            // Listen for real-time changes
            this.unsubscribe = db.collection('users').doc(userId).collection('data').doc('shoppingList')
                .onSnapshot((snapshot) => {
                    if (snapshot.exists && snapshot.data()) {
                        const data = snapshot.data();
                        if (data.items) {
                            this.items = data.items;
                            this.saveToLocalStorage();
                            this.renderItems();
                            console.log('Real-time sync: shopping list updated from Firebase');
                        }
                    }
                }, (error) => {
                    console.error('Error listening to shopping list changes:', error);
                });

            console.log('Real-time sync enabled for shopping list');
        }
    }

    // Cleanup when destroying the instance
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    renderItems() {
        const container = document.getElementById('shoppingItems');
        const emptyState = document.getElementById('shoppingEmpty');

        if (this.items.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = this.items.map(item => this.createItemHtml(item)).join('');

        this.bindItemEvents();
    }

    createItemHtml(item) {
        const categoryLabels = {
            vegetables: '🥕 Овощи',
            fruits: '🍎 Фрукты',
            meat: '🥩 Мясо',
            fish: '🐟 Рыба',
            dairy: '🧀 Молочные',
            bakery: '🍞 Выпечка',
            drinks: '🥤 Напитки',
            snacks: '🍿 Закуски',
            other: '📦 Другое'
        };

        const categoryHtml = item.category 
            ? `<span class="shopping-item-category">${categoryLabels[item.category] || item.category}</span>`
            : '';

        return `
            <div class="shopping-item ${item.completed ? 'completed' : ''}" data-id="${item.id}">
                <div class="shopping-item-checkbox ${item.completed ? 'checked' : ''}"></div>
                <div class="shopping-item-content">
                    <span class="shopping-item-name">${this.escapeHtml(item.name)}</span>
                    ${item.quantity ? `<span class="shopping-item-quantity">${this.escapeHtml(item.quantity)}</span>` : ''}
                    ${categoryHtml}
                </div>
                <button class="shopping-item-delete" data-id="${item.id}" title="Удалить">🗑️</button>
            </div>
        `;
    }

    bindItemEvents() {
        document.querySelectorAll('.shopping-item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                const itemElement = e.target.closest('.shopping-item');
                const itemId = itemElement.dataset.id;
                this.toggleComplete(itemId);
            });
        });

        document.querySelectorAll('.shopping-item-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.dataset.id;
                this.deleteItem(itemId);
            });
        });
    }

    bindEvents() {
        document.getElementById('addShoppingItemBtn').addEventListener('click', () => {
            this.openAddModal();
        });

        document.getElementById('clearCompletedBtn').addEventListener('click', () => {
            this.clearCompleted();
        });

        document.getElementById('clearAllBtn').addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите очистить весь список покупок?')) {
                this.clearAll();
            }
        });

        document.getElementById('closeShoppingModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('shoppingModal').addEventListener('click', (e) => {
            if (e.target.id === 'shoppingModal') {
                this.closeModal();
            }
        });

        document.getElementById('shoppingForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addItem();
        });
    }

    openAddModal() {
        document.getElementById('shoppingModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        document.getElementById('shoppingItemName').focus();
    }

    closeModal() {
        document.getElementById('shoppingModal').classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('shoppingForm').reset();
    }

    addItem() {
        const name = document.getElementById('shoppingItemName').value.trim();
        const quantity = document.getElementById('shoppingItemQuantity').value.trim();
        const category = document.getElementById('shoppingItemCategory').value;

        if (!name) return;

        const item = {
            id: Date.now(),
            name,
            quantity,
            category,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.items.unshift(item);
        this.saveItems();
        this.renderItems();
        this.closeModal();
        this.recipeBook.showToast('Товар добавлен в список! 🛒');
    }

    toggleComplete(id) {
        const item = this.items.find(i => String(i.id) === String(id));
        if (item) {
            item.completed = !item.completed;
            this.saveItems();
            this.renderItems();
        }
    }

    deleteItem(id) {
        this.items = this.items.filter(i => String(i.id) !== String(id));
        this.saveItems();
        this.renderItems();
        this.recipeBook.showToast('Товар удален из списка 🗑️');
    }

    clearCompleted() {
        const completedCount = this.items.filter(i => i.completed).length;
        if (completedCount === 0) {
            this.recipeBook.showToast('Нет выполненных товаров для удаления');
            return;
        }
        this.items = this.items.filter(i => !i.completed);
        this.saveItems();
        this.renderItems();
        this.recipeBook.showToast(`Удалено ${completedCount} выполненных товаров ✅`);
    }

    clearAll() {
        this.items = [];
        this.saveItems();
        this.renderItems();
        this.recipeBook.showToast('Список покупок очищен 🗑️');
    }

    generateFromMenu(menu) {
        // Generate shopping list from menu recipes
        // This is a placeholder - in a real app, you'd parse recipe ingredients
        const recipeNames = Object.values(menu).map(m => m.name);
        
        if (recipeNames.length === 0) {
            this.recipeBook.showToast('Меню пустое. Добавьте рецепты в меню сначала.');
            return;
        }

        // Add a placeholder item for each recipe
        recipeNames.forEach(name => {
            const existingItem = this.items.find(i => i.name === `Ингредиенты для: ${name}`);
            if (!existingItem) {
                this.items.unshift({
                    id: Date.now() + Math.random(),
                    name: `Ингредиенты для: ${name}`,
                    quantity: '',
                    category: 'other',
                    completed: false,
                    createdAt: new Date().toISOString()
                });
            }
        });

        this.saveItems();
        this.renderItems();
        this.recipeBook.showToast(`Список покупок сформирован из ${recipeNames.length} рецептов! 🛒`);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add('ripple');

    const ripple = button.getElementsByClassName('ripple')[0];
    if (ripple) {
        ripple.remove();
    }

    button.appendChild(circle);
}

// Theme Toggle
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
}

// Add ripple effect to all buttons
document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('button, .recipe-btn');
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    new ParticlesAnimation();
    // ParallaxEffect disabled - removed parallax effect
    // new ParallaxEffect();
    
    // Initialize Auth Manager
    window.authManager = new AuthManager();
    
    // Initialize Recipe Book
    window.recipeBook = new RecipeBook();
    
    // Bind auth events
    bindAuthEvents();
});

// Bind authentication events
function bindAuthEvents() {
    const authToggle = document.getElementById('authToggle');
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const authForm = document.getElementById('authForm');
    const authSubtabs = document.querySelectorAll('.auth-subtab');
    const authTitle = document.getElementById('authTitle');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authSubmitText = document.getElementById('authSubmitText');
    const nameGroup = document.getElementById('nameGroup');
    const authError = document.getElementById('authError');
    const googleAuthBtn = document.getElementById('googleAuthBtn');
    
    let currentMode = 'login'; // 'login' or 'register'
    
    // Toggle auth modal
    authToggle.addEventListener('click', () => {
        if (window.authManager.currentUser) {
            // Sign out
            window.authManager.signOut();
        } else {
            // Open auth modal
            authModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            document.getElementById('authEmail').focus();
        }
    });
    
    // Close auth modal
    closeAuthModal.addEventListener('click', () => {
        authModal.classList.remove('active');
        document.body.style.overflow = '';
        authForm.reset();
        authError.style.display = 'none';
    });
    
    // Close on backdrop click
    authModal.addEventListener('click', (e) => {
        if (e.target.id === 'authModal') {
            authModal.classList.remove('active');
            document.body.style.overflow = '';
            authForm.reset();
            authError.style.display = 'none';
        }
    });
    
    // Subtab switching (Login/Register)
    authSubtabs.forEach(subtab => {
        subtab.addEventListener('click', () => {
            authSubtabs.forEach(t => t.classList.remove('active'));
            subtab.classList.add('active');
            
            currentMode = subtab.dataset.subtab;
            
            if (currentMode === 'login') {
                authSubmitText.textContent = 'Войти';
                nameGroup.style.display = 'none';
            } else {
                authSubmitText.textContent = 'Зарегистрироваться';
                nameGroup.style.display = 'block';
            }
            
            authError.style.display = 'none';
        });
    });
    
    // Google auth
    googleAuthBtn.addEventListener('click', async () => {
        authError.style.display = 'none';
        googleAuthBtn.disabled = true;
        googleAuthBtn.querySelector('.google-text').textContent = 'Вход...';
        
        try {
            await window.authManager.signInWithGoogle();
            authModal.classList.remove('active');
            document.body.style.overflow = '';
            authForm.reset();
        } catch (error) {
            authError.textContent = error;
            authError.style.display = 'block';
        } finally {
            googleAuthBtn.disabled = false;
            googleAuthBtn.querySelector('.google-text').textContent = 'Войти через Google';
        }
    });
    
    // Password visibility toggle
    const passwordToggle = document.getElementById('passwordToggle');
    const authPassword = document.getElementById('authPassword');
    
    if (passwordToggle && authPassword) {
        passwordToggle.addEventListener('click', () => {
            const type = authPassword.type === 'password' ? 'text' : 'password';
            authPassword.type = type;
            passwordToggle.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }
    
    // Email form submission
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const name = document.getElementById('authName').value.trim();
        
        // Disable submit button
        authSubmitBtn.disabled = true;
        authSubmitText.textContent = currentMode === 'login' ? 'Вход...' : 'Регистрация...';
        authError.style.display = 'none';
        
        try {
            if (currentMode === 'login') {
                await window.authManager.signIn(email, password);
            } else {
                await window.authManager.signUp(email, password, name);
            }
            
            // Close modal on success
            authModal.classList.remove('active');
            document.body.style.overflow = '';
            authForm.reset();
            
        } catch (error) {
            // Show error
            authError.textContent = error;
            authError.style.display = 'block';
        } finally {
            // Re-enable submit button
            authSubmitBtn.disabled = false;
            authSubmitText.textContent = currentMode === 'login' ? 'Войти' : 'Зарегистрироваться';
        }
    });
}
