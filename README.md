# Todo PWA

Une application de gestion de tâches style Kanban, fonctionnant comme une Progressive Web App (PWA).

## Fonctionnalités

### Gestion des tâches
- **3 colonnes** : Backlog, En Cours, Terminé
- **Drag & Drop** : Déplacez les tâches entre les colonnes
- **Persistance** : Les données sont sauvegardées dans le localStorage

### Tags
- Ajoutez des tags avec `#tag` (ex: `#work`, `#urgent`)
- **Autocomplétion** : Tapez `#` pour voir les tags existants
- Les tags s'affichent comme des badges colorés

### Tags spéciaux
| Tag | Effet |
|-----|-------|
| `#pin` | Épingle la tâche en haut de la liste |
| `#prio` | Marque la tâche comme prioritaire (fond rouge) |

### Navigation au clavier

| Touche | Action |
|--------|--------|
| `↑` / `↓` | Naviguer dans la colonne (circulaire) |
| `←` / `→` | Déplacer la tâche entre colonnes |
| `Entrée` | Éditer la tâche sélectionnée |
| `P` | Épingler/Désépingler |
| `Backspace` / `Suppr` | Supprimer la tâche |

### Raccourcis dans l'édition
- `Entrée` : Sauvegarder
- `Échap` : Annuler
- `#` : Afficher l'autocomplétion des tags

## Installation

### Option 1 : Mode simple (LocalStorage)
Ouvrez simplement `index.html` dans votre navigateur.

### Option 2 : Mode serveur (Fichier sur disque)
1. Assurez-vous d'avoir Node.js installé
2. Lancez le serveur :
   ```bash
   node server.js
   ```
3. Ouvrez http://localhost:3000 dans votre navigateur
4. Les tâches seront sauvegardées dans `tasks.json`

Pour installer comme PWA :
1. Ouvrez l'application dans Chrome/Edge
2. Cliquez sur l'icône d'installation dans la barre d'adresse
3. Ou utilisez le menu "Installer l'application"

## Fichiers

- `index.html` - Structure HTML
- `style.css` - Styles CSS
- `script.js` - Logique JavaScript
- `server.js` - Serveur Node.js (stockage sur disque)
- `tasks.json` - Fichier de données (créé automatiquement)
- `manifest.json` - Configuration PWA
- `sw.js` - Service Worker pour le mode offline
- `.gitignore` - Fichiers à ignorer par Git
- `README.md` - Documentation

## Technologies

- HTML5
- CSS3
- JavaScript (ES6+)
- Node.js
- Service Workers
- API REST (fetch)

## Licence

MIT
