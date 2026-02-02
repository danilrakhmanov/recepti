# Правила безопасности Firebase Firestore

Для работы синхронизации данных между устройствами необходимо настроить правила безопасности в консоли Firebase.

## Инструкция по настройке:

1. Откройте консоль Firebase: https://console.firebase.google.com/
2. Выберите ваш проект: `recepti-93f83`
3. Перейдите в раздел: Firestore Database -> Rules
4. Замените текущие правила на следующие:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Рецепты - чтение и запись для всех авторизованных пользователей
    match /recipes/{recipeId} {
      allow read, write: if request.auth != null;
    }
    
    // Список покупок - чтение и запись для всех авторизованных пользователей
    match /shoppingList/{itemId} {
      allow read, write: if request.auth != null;
    }
    
    // Настройки (меню) - чтение и запись для всех авторизованных пользователей
    match /settings/{documentId} {
      allow read, write: if request.auth != null;
    }
    
  }
}
```

## Вариант для тестирования (без авторизации):

Если вы хотите протестировать синхронизацию без настройки аутентификации, используйте эти правила (только для разработки!):

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Разрешить чтение и запись всем (только для тестирования!)
    match /{document=**} {
      allow read, write: if true;
    }
    
  }
}
```

## Рекомендации по безопасности:

Для продакшн-версии рекомендуется:
1. Настроить Firebase Authentication
2. Ограничить доступ к данным только для авторизованных пользователей
3. Добавить валидацию данных
4. Использовать пользовательские утверждения (claims) для управления доступом

## Пример правил с валидацией данных:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Рецепты с валидацией
    match /recipes/{recipeId} {
      allow read, write: if request.auth != null
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.mealType in ['first', 'second', 'salads', 'snacks', 'baking', 'dessert'];
    }
    
    // Список покупок с валидацией
    match /shoppingList/{itemId} {
      allow read, write: if request.auth != null
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0;
    }
    
    // Настройки (меню)
    match /settings/{documentId} {
      allow read, write: if request.auth != null;
    }
    
  }
}
```
