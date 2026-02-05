// Скрипт миграции рецептов из users/{uid}/recipes в users/{uid}/data/recipes
// Запуск: node migrate-recipes.js

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Конфигурация сервисного аккаунта
const serviceAccount = require('./service-account-key.json');

// Инициализация Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const USER_ID = 'BHp3aoqYOWWzHOr5nAQ4X1Ltkuq1'; // UID пользователя

async function migrateRecipes() {
  try {
    console.log('🚀 Начинаем миграцию рецептов...');
    console.log(`📁 Целевой пользователь: ${USER_ID}`);

    // Старый путь: users/{uid}/recipes
    const oldRecipesRef = db.collection(`users/${USER_ID}/recipes`);
    const snapshot = await oldRecipesRef.get();

    if (snapshot.empty) {
      console.log('❌ В старой коллекции нет рецептов');
      return;
    }

    console.log(`📚 Найдено ${snapshot.size} рецептов для миграции`);

    // Новый путь: users/{uid}/data/recipesContainer/recipes
    // Создаём документ "recipesContainer" в коллекции data
    const containerDocRef = db.doc(`users/${USER_ID}/data/recipesContainer`);
    const newRecipesRef = containerDocRef.collection('recipes');

    // Создаём документ-контейнер (если не существует)
    const containerDoc = await containerDocRef.get();
    if (!containerDoc.exists) {
      await containerDocRef.set({ 
        type: 'recipesContainer',
        createdAt: new Date().toISOString() 
      });
      console.log('📄 Создан контейнер data/recipesContainer');
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const recipeData = doc.data();
        
        // Сохраняем тот же ID документа
        await newRecipesRef.doc(doc.id).set({
          ...recipeData,
          migratedAt: new Date().toISOString()
        });
        
        // Удаляем из старого места
        await oldRecipesRef.doc(doc.id).delete();
        
        migratedCount++;
        console.log(`✅ Перенесён рецепт: ${recipeData.name || doc.id}`);
      } catch (err) {
        errorCount++;
        console.error(`❌ Ошибка с рецептом ${doc.id}:`, err.message);
      }
    }

    console.log(`\n🎉 Миграция завершена!`);
    console.log(`📊 Перенесено: ${migratedCount} рецептов`);
    console.log(`📊 Ошибок: ${errorCount}`);
    console.log(`📂 Откуда: users/${USER_ID}/recipes`);
    console.log(`📂 Куда: users/${USER_ID}/data/recipesContainer/recipes`);

  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  }
}

migrateRecipes();
