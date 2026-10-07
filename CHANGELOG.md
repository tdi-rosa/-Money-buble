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
