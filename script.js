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
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadRecipes();
        this.renderRecipes();
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
                this.saveToLocalStorage();
            }
        } else {
            this.saveToLocalStorage();
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
            }
        });
    }

    // Open modal
    openModal() {
        document.getElementById('modal').classList.add('active');
        document.getElementById('recipeName').focus();
    }

    // Close modal
    closeModal() {
        document.getElementById('modal').classList.remove('active');
        document.getElementById('recipeForm').reset();
    }

    // Add new recipe
    async addRecipe() {
        const name = document.getElementById('recipeName').value.trim();
        const mealType = document.getElementById('mealType').value;
        const url = document.getElementById('recipeUrl').value.trim();
        const description = document.getElementById('recipeDescription').value.trim();
        const cookingTime = document.getElementById('cookingTime').value.trim();
        const imageUrl = document.getElementById('imageUrl').value.trim();

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
        await this.saveRecipes();
        this.renderRecipes();
        this.closeModal();
        this.showToast('Рецепт успешно добавлен! 🎉');
    }

    // Delete recipe
    async deleteRecipe(id) {
        if (confirm('Вы уверены, что хотите удалить этот рецепт?')) {
            if (useFirebase && db) {
                try {
                    await db.collection('recipes').doc(String(id)).delete();
                } catch (error) {
                    console.error('Error deleting from Firebase:', error);
                }
            }
            this.recipes = this.recipes.filter(r => r.id !== id);
            await this.saveRecipes();
            this.renderRecipes();
            this.showToast('Рецепт удален 🗑️');
        }
    }

    // Toggle favorite
    async toggleFavorite(id) {
        const recipe = this.recipes.find(r => r.id === id);
        if (recipe) {
            recipe.favorite = !recipe.favorite;
            
            if (useFirebase && db) {
                try {
                    const { id: recipeId, ...recipeData } = recipe;
                    await db.collection('recipes').doc(String(id)).set(recipeData);
                } catch (error) {
                    console.error('Error updating favorite in Firebase:', error);
                }
            }
            
            await this.saveRecipes();
            this.renderRecipes();
            this.showToast(recipe.favorite ? 'Добавлено в избранное ❤️' : 'Удалено из избранного 💔');
        }
    }

    // Set filter
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
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
            breakfast: '🌅 Завтрак',
            lunch: '☀️ Обед',
            dinner: '🌙 Ужин'
        };
        return labels[type] || type;
    }

    // Get default emoji for meal type
    getMealTypeEmoji(type) {
        const emojis = {
            breakfast: '🥞',
            lunch: '🍝',
            dinner: '🍲'
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
            ? `<div class="recipe-meta-item">
                <span>⏱️</span>
                <span>${this.escapeHtml(recipe.cookingTime)}</span>
               </div>`
            : '';

        const descriptionHtml = recipe.description 
            ? `<p class="recipe-description">${this.escapeHtml(recipe.description)}</p>`
            : '';

        return `
            <div class="recipe-card" style="animation-delay: ${index * 0.1}s" data-id="${recipe.id}">
                <div class="recipe-image">
                    ${imageHtml}
                </div>
                <div class="recipe-content">
                    <div class="recipe-header">
                        <h3 class="recipe-title">${this.escapeHtml(recipe.name)}</h3>
                        <span class="recipe-type ${recipe.mealType}">${this.getMealTypeLabel(recipe.mealType)}</span>
                    </div>
                    ${descriptionHtml}
                    <div class="recipe-meta">
                        ${timeHtml}
                    </div>
                    <div class="recipe-actions">
                        <a href="${this.escapeHtml(recipe.url)}" target="_blank" class="recipe-btn primary">
                            <span>🔗</span>
                            <span>Открыть</span>
                        </a>
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
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.toggleFavorite(id);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.deleteRecipe(id);
            });
        });
    }

    // Show toast notification
    showToast(message) {
        const toast = document.getElementById('toast');
        const toastMessage = toast.querySelector('.toast-message');
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

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new RecipeBook();
});
