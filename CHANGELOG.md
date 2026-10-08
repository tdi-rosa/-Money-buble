## 0.7.6

- Le vide représente exactement la somme de l’amas affiché ; le maximum vaut le solde restant à cette date plus ces dépenses.
- Supprime le repère indépendant basé sur un apport et son réglage manuel. Le solde historique reste reconstruit avec les entrées et sorties reçues.
- Les bulles conservées lors d’une contraction bénéficient aussi de l’attraction de regroupement, puis retrouvent la physique douce après la transition.

## 0.7.5

- Pincement limité à 0,6×–6× dans chaque mode ; déplacement à deux doigts et inversion continue, sans changer de période.
- Attraction de regroupement et dispersion utilisent le même ressort, amortissement et plafond de vitesse à l’écran.
- Le plein du réservoir inclut le reliquat disponible avant le principal apport, sans le réajuster à chaque dépense.
- Surface liquide amortie, proportionnelle au solde, avec repère du niveau précédent et variation temporaire pour percevoir les petits écarts.
- L’animation liquide s’arrête au repos et respecte la préférence de réduction du mouvement.

## 0.7.4

- Retire le déplacement individuel au doigt, en conservant les gestes de navigation et le toucher des dépenses.
- Resserre le cadrage sur l’enveloppe réelle de l’amas et harmonise la vitesse d’arrivée et de départ à l’écran.
- Déporte la simulation dès 60 bulles, sans retirer la physique ni les collisions.
- Réservoir plus épais, animé, calculé à partir du principal apport ; les petites entrées modifient son niveau.
- Synchronise débits et crédits pour reconstruire le solde en fin de période ; distingue les estimations historiques et l’historique indisponible.

## 0.7.3

- Supprime les amas imbriqués par jour/semaine : toutes les dépenses se réunissent en un seul amas compact.
- Simulation continue, attraction centrale, dérive douce et collisions : les bulles ne sont plus attachées à des positions individuelles.
- Cadrage sur les limites réelles de l’amas, avec dézoom depuis le centre et surfaces proportionnelles.
- Placement initial par front-chain, mis en cache ; la simulation des gros historiques tourne dans un worker séparé pour garder les gestes réactifs.

## 0.7.2

- Rétablit les ressorts, les collisions et le déplacement des bulles au doigt.
- Les collisions utilisent des grilles par taille et un nombre borné de passes, sans simulation de tout l’historique.
- Conserve la géométrie imbriquée, le dézoom centré et les surfaces proportionnelles.

## 0.7.1 — 2026-10-08

- Nested, immutable expense geometry: selected day coordinates survive the week and month expansion.
- One shared amount scale with stable camera references across dates; smaller periods are not independently enlarged.
- Centered camera expansion and radial arrivals replace collision keyframes and per-period repacking.
- Reusable catalog, compact worker messages and cached layouts/previews remove repeated month calculations.
- Incoming and outgoing slide pages retain exactly one viewport width of separation.

## 0.7.0 — 2026-10-08

- One proportional expense cluster for the day, week or month. Other days join the same cluster when zooming out.
- Collision-safe transition keyframes run in the worker; canvas rendering performs no physics simulation.
- Interruptible swipes with adjacent-period previews, direct touch tracking, recent-velocity flicks and continuous reversible pinch gestures.
- Expense details open at every scale, with hit regions captured from the painted circles.
- Versioned transparent black three-circle icons and fresh manifest retrieval for installed apps.

# Versions

## 0.4.0

- Connexion BNP via Enable Banking, consultation seulement, sur l’adresse de production permanente.
- Clé RSA côté serveur ; cookie de session chiffré, HttpOnly, Secure ; retour bancaire protégé par état aléatoire.
- Compte sélectionnable, actualisation à l’ouverture et toutes les 10 minutes au premier plan, déconnexion avec révocation de session.
- Débits EUR comptabilisés des 90 derniers jours ; solde disponible ou comptable identifié. Pas de promesse de détection instantanée ni du sans-contact.
- Aucune base de données bancaire : opérations en mémoire dans la page ; notes et préférences locales.
- Configuration et autorisation réelle nécessaires avant usage.

## 0.3.0

- Empreinte du code générée à chaque déploiement : les changements déclenchent une nouvelle version automatiquement.

- Application automatique des nouvelles versions complètes, sans bouton de mise à jour.
- Vérification à chaque ouverture/retour au premier plan et toutes les minutes pendant l’utilisation.
- Activation différée tant qu’une bulle est saisie ou qu’un panneau est ouvert.
- Données locales conservées. Adresse de production stable indispensable : un lien contenant le hash d’un déploiement ne se met pas à jour.

## 0.2.0

- Nouvelle interface mobile plein écran avec très peu de texte.
- Simulation Canvas : attraction, collisions, bulles saisissables, retour au centre.
- Navigation par swipe ; regroupement par jour en semaine et par semaine en mois.
- Jauge de solde actuel, avec repère visuel configurable. Solde fictif marqué démo ; montant réel saisi manuellement tant que BNP n'est pas connecté.
- Notes et imports de la version précédente conservés. Catégories corrigibles, export JSON, confidentialité des montants et réduction du mouvement.
- Cache de l'app cohérent par version, notification de mise à jour. Aucun cache bancaire.

## 0.1.0

- Première démonstration et import local de dépenses.
