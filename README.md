# 🃏 Scores — Belote · Contrée · Tarot

Compteurs de points pour jeux de cartes, optimisés mobile. Site statique, aucune dépendance, aucun serveur.

## Design

Habillage « table de jeu » : fond feutre, crème, titres en DM Serif Display, un accent de couleur par jeu (vert belote, or contrée, rouge tarot). Chaque jeu suit le même parcours par écrans : **saisie de la donne → tableau des scores → fin de partie**, avec aperçu en temps réel du résultat avant validation.

## Structure

```
scores/
├── index.html          # Accueil — choix du jeu, badges "en cours"
├── css/
│   └── common.css      # Design partagé (variables, écrans, composants)
├── belote/   { index.html, app.js }
├── contree/  { index.html, app.js }
└── tarot/    { index.html, app.js }
```

Chaque jeu sauvegarde sa partie dans le navigateur (localStorage, une clé par jeu : `belote-state-v1`, `contree-state-v1`, `tarot-state-v1`). Trois parties peuvent coexister. En rouvrant un jeu avec une partie en cours, on arrive directement sur le tableau des scores.

## Règles implémentées

### Belote
Saisie des points d'une équipe (l'autre déduite), belote/rebelote (+20), dix de der (+10), capot (250), litige 81/81 (le défenseur garde 81, les 81 restants vont au vainqueur de la donne suivante).

### Contrée — 3 modes de comptage
- **Contrat** : tenu → annonceur marque le contrat, défense 0 ; chuté → défense 160. Coinche ×2, surcoinche ×4.
- **Contrat + réalisé** : part contrat + points réalisés des deux équipes (option arrondi).
- **Réalisé** : uniquement les points réalisés (option arrondi).
- Annonces 80→160, capot (250), capot beloté (270).
- Réussite : annonceur ≥ contrat **et** strictement supérieur à la défense, belote des deux côtés incluse (donc 80 annoncé → 82 mini).
- Option « compter la belote » (mode contrat) : si activée, l'équipe qui l'a marque 20 quoi qu'il arrive ; sinon elle sert seulement à tenir/faire chuter.
- Arrondi à la dizaine : reste ≤ 5 vers le bas (85→80), ≥ 6 vers le haut (86→90).
- Objectif pré-rempli selon le mode (1010 / 2001 ou 2010 / 1001 ou 1010), modifiable.

### Tarot — barème FFT, 3 à 5 joueurs
- Contrats petite ×1, garde ×2, garde sans ×4, garde contre ×6.
- Score = (25 + écart) × multiplicateur ; seuils 56/51/41/36 selon 0/1/2/3 bouts.
- Petit au bout ±10 × multiplicateur ; poignées simple/double/triple (+20/+30/+40) au camp vainqueur ; chelem +200 (non annoncé) / +400 (annoncé) / −200 (chuté).
- À 5 joueurs : preneur 2 parts, partenaire 1 part ; appel à soi-même = seul contre 4.
- Changer le nombre de joueurs réinitialise la partie (confirmation).

## Lancer en local

Ouvrir `index.html` dans un navigateur. (Astuce VS Code : extension **Live Server**, clic droit sur `index.html` → *Open with Live Server*.)

## Déployer sur GitHub Pages

1. Pousser le dossier sur un dépôt GitHub **public**.
2. Dépôt → **Settings → Pages → Source : Deploy from a branch → `main` / `(root)` → Save**.
3. Le site est en ligne sous 1-2 min à `https://TON_PSEUDO.github.io/NOM_DEPOT/`.

Mise à jour : commit + push (ou *Sync Changes* dans VS Code), redéploiement automatique.

## Notes

- Les scores restent locaux à chaque appareil (rien n'est partagé ni envoyé sur un serveur).
- Les polices se chargent depuis Google Fonts ; hors ligne, un fallback système prend le relais.
