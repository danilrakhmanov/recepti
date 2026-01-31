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
let useFirebase = false;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    useFirebase = true;
    console.log('Firebase initialized successfully');
} catch (error) {
    console.warn('Firebase not configured, using localStorage:', error.message);
    useFirebase = false;
}

// Recipe Book Application
class RecipeBook {
    constructor() {
        this.recipes = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.editingId = null;
        this.recipeToDelete = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadRecipes();
        this.renderRecipes();
        // Hide loading screen immediately
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }

    // Load recipes from Firebase or localStorage
    async loadRecipes() {
        if (useFirebase && db) {
            try {
                const snapshot = await db.collection('recipes').get();
                this.recipes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log('Recipes loaded from Firebase:', this.recipes.length);
            } catch (error) {
                console.error('Error loading from Firebase:', error);
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
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
        if (useFirebase && db) {
            try {
                // Save each recipe to Firebase
                for (const recipe of this.recipes) {
                    const { id, ...recipeData } = recipe;
                    await db.collection('recipes').doc(String(id)).set(recipeData);
                }
                console.log('Recipes saved to Firebase');
            } catch (error) {
                console.error('Error saving to Firebase:', error);
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
        // Add recipe button
        document.getElementById('addRecipeBtn').addEventListener('click', () => {
            this.openModal();
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

        // Mobile navigation
        document.querySelectorAll('.mobile-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.setFilter(item.dataset.filter);
            });
        });
    }

    // Open modal
    openModal() {
        this.editingId = null;
        document.querySelector('.modal-title').textContent = 'Добавить рецепт';
        document.querySelector('.submit-btn .btn-text').textContent = 'Сохранить рецепт';
        document.getElementById('modal').classList.add('active');
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

        document.getElementById('modal').classList.add('active');
        document.getElementById('recipeName').focus();
    }

    // Close modal
    closeModal() {
        document.getElementById('modal').classList.remove('active');
        document.getElementById('recipeForm').reset();
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
        this.recipeToDelete = null;
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
        this.currentFilter = filter;

        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        // Update mobile navigation
        document.querySelectorAll('.mobile-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.filter === filter);
        });

        this.renderRecipes();
    }

    // Get filtered recipes
    getFilteredRecipes() {
        let filtered = [...this.recipes];

        // Apply search filter
        if (this.searchQuery) {
            filtered = filtered.filter(recipe => 
                recipe.name.toLowerCase().includes(this.searchQuery) ||
                recipe.description.toLowerCase().includes(this.searchQuery)
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
            dessert: '🍰 Десерт',
            snacks: '🥗 Закуски'
        };
        return labels[type] || type;
    }

    // Get default emoji for meal type
    getMealTypeEmoji(type) {
        const emojis = {
            first: '🍲',
            second: '🍝',
            dessert: '🍰',
            snacks: '🥗'
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

        return `
            <div class="recipe-card" style="animation-delay: ${index * 0.05}s" data-id="${recipe.id}">
                <div class="recipe-image">
                    ${imageHtml}
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
                            <a href="${this.escapeHtml(recipe.url)}" target="_blank" class="recipe-btn primary">
                                <span>🔗</span>
                                <span>Открыть</span>
                            </a>
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
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.openEditModal(id);
            });
        });

        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.toggleFavorite(id);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.deleteRecipe(id);
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
    new ParallaxEffect();
    new RecipeBook();
});
