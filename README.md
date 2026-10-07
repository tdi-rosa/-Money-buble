# Money Bubble

Hébergement indépendant : Vercel. Le propriétaire a déployé et installé l'app sur Android.

Dépôt : https://github.com/tdi-rosa/-Money-buble

Le code est sur ce GitHub. Les tests tournent automatiquement après un push. `vercel.json` contient les paramètres de publication : framework Other, racine du dépôt, sortie `dist`. Importer ce dépôt depuis https://vercel.com/new puis cliquer Deploy. Après liaison, les changements sur `main` sont déployés automatiquement. Utiliser l'adresse de production `.vercel.app` pour installer l'app, sans connexion à ChatGPT. L'accès API Vercel de cette session ne permet pas d'inspecter les déploiements. Utiliser une adresse de production stable pour recevoir les nouvelles versions ; une URL de déploiement avec un hash reste attachée à une version précise.

PWA personnelle en français, conçue pour visualiser les dépenses quotidiennes sur Android/Fairphone. Version 0.2.0 : interface minimaliste, simulation Canvas interactive, regroupements jour/semaine/mois et import JSON local. **La connexion bancaire n'est pas encore implémentée ni activée.**

## Utilisation

Ouvrir le site dans Chrome sur Android puis utiliser « Installer l'application » ou « Ajouter à l'écran d'accueil ». L'installation et le mode hors ligne doivent être vérifiés sur le téléphone. Utiliser le domaine de production Vercel accessible publiquement pour la démonstration ; les futures données bancaires nécessiteront une authentification propre à Money Bubble. Les achats fictifs sont signalés et ne sont jamais mélangés aux imports. Les données importées et notes sont enregistrées uniquement dans le navigateur, sans chiffrement applicatif. Ne pas considérer cette version comme un coffre bancaire sécurisé.

Une bulle représente une dépense positive, sa surface suit le montant, avec un minimum de rayon pour les très petites dépenses. L'échelle s'adapte à l'espace disponible : comparer les montants affichés entre périodes, pas uniquement les tailles. Au-delà de 240 achats visibles, les dépenses sont regroupées par catégorie dans chaque amas ; leurs totaux sont conservés et le détail reste accessible. Cliquer le montant total ouvre aussi la liste. Les revenus, remboursements et devises autres que l'euro ne sont pas pris en charge par cet import initial.

## Développement et mises à jour

Application sans dépendances ni compilation : les fichiers servis sont dans `dist/`. Lancer `npm test` et `npm run check`. Pour servir localement : `python3 -m http.server 8080 --directory dist`. Publier la nouvelle version après chaque modification. Incrémenter le nom du cache dans `dist/sw.js`, la version dans `package.json` et l'affichage de version. Une notification propose de charger la nouvelle version ; vérifier les mises à jour à chaque retour dans l'app. Le dépôt contient le code et aucun historique bancaire ni secret.

## Interface 0.2.0

- Les bulles reviennent vers leur centre d'attraction après déplacement. Swipe horizontal sur une zone libre : période suivante ou précédente. Flèches et sélecteur de date disponibles aussi.
- Jour : un amas d'achats. Semaine : sept amas journaliers. Mois : amas par semaine civile, limités aux jours du mois. Toucher une étiquette d'amas zoome.
- Toucher une bulle ouvre son détail : ressenti, note et catégorie corrigible. Les anciens imports et notes sont conservés.
- Jauge du solde actuel avec repère visuel choisi manuellement. Ce repère n'est pas un budget. Valeur fictive marquée démo, ou valeur saisie marquée saisi ; aucune estimation des soldes historiques.
- Montants masquables, réduction du mouvement (respecte le système par défaut), vibrations facultatives, export JSON.
- Simulation à pas fixe, collisions avec grille spatiale, sprites précalculés, DPR plafonné à 2, animation suspendue quand l'app est en arrière-plan.

## Import

Voir `dist/example-transactions.json`. Montants en centimes entiers positifs. Catégories : `food`, `out`, `transport`, `shopping`, `other`. `dateBasis: transaction` uniquement si une vraie date d'achat est fournie ; sinon `booking`. `status: pending` ou `booked`. Un identifiant unique et stable par opération. L'import remplace les données précédentes et les notes, il ne les fusionne pas.

## Connexion BNP : architecture retenue

Enable Banking est la piste privilégiée : accès personnel aux comptes autorisés et support BNP Paribas France. Documentation : https://enablebanking.com/docs/api/reference/ ; usage personnel : https://enablebanking.com/terms/ ; BNP : https://enablebanking.com/docs/markets/fr/ . La gratuité et la compatibilité doivent être confirmées au moment de l'inscription.

1. Enregistrer une application de production sur Enable Banking, autoriser ses propres comptes et enregistrer l'URL de retour exacte. Ne jamais transmettre le mot de passe BNP à Bulles.
2. Ajouter un backend privé, par exemple Node.js sur Railway, et Postgres en région européenne. Frontend et API de préférence sous le même domaine ; une authentification du propriétaire est obligatoire avant toute donnée réelle.
3. Conserver la clé RSA en secret serveur uniquement ; signer les JWT RS256 pour Enable Banking. GET `/aspsps`, sélectionner le connecteur BNP FR retourné, puis POST `/auth`, et POST `/sessions` au retour. Vérifier un `state` aléatoire lié à une session propriétaire, à usage unique, avec expiration ; ne jamais ouvrir le retour bancaire au public sans contrôle.
4. Demander uniquement les informations de compte. N'implémenter aucun endpoint de paiement. Choisir explicitement le compte courant parmi les comptes consentis.
5. Synchroniser GET `/accounts/{uid}/transactions` en gérant la pagination, les quotas, les erreurs et l'expiration de consentement. Commencer par une synchronisation à l'ouverture, puis quelques fois par jour selon les limites BNP effectivement retournées. Afficher l'heure de la dernière synchronisation réussie et le statut du consentement. Aucun instantané garanti.
6. Conserver les transactions originales chiffrées au repos, séparer secrets et code, ne pas journaliser les données bancaires. L'API renvoie uniquement les données nécessaires à l'utilisateur authentifié avec `Cache-Control: no-store`. Aucun cache service worker de l'API. Prévoir suppression locale/serveur et révocation de session.
7. Stocker chaque opération avec son identifiant stable fournisseur et compte ; réconcilier les opérations en attente devenues comptabilisées. Ne pas dédupliquer uniquement par date et montant : deux vrais achats peuvent être identiques. Si aucun identifiant stable n'existe, conserver une réconciliation explicite, sans suppression silencieuse. Conserver les remboursements séparément et les lier à l'achat si une référence fiable existe.
8. Date d'achat prioritaire si réellement fournie, sinon date comptable explicitement indiquée. Ne pas inventer une heure. Ne pas déduire « sans contact » simplement d'un paiement carte. Pour les cartes à débit différé, vérifier que BNP expose les achats unitaires avant de considérer la connexion comme adaptée.

## Objectif produit

Créer une perception, pas seulement un tableau : amas quotidien, comparaison à échelle constante, somme des petits achats, historique sur sept jours et ressenti après achat. Les dépenses fixes pourront ensuite avoir une vue distincte afin qu'un loyer n'écrase pas la perception des achats quotidiens. Les catégories sont provisoires et devront pouvoir être corrigées manuellement. Les rappels et notifications viendront après validation de la remontée bancaire.

## Validation restante

Neuf tests automatiques : montants, dates, imports, placement, collisions, retour au centre, transitions et regroupements calendaires. Vérification visuelle locale bloquée par le navigateur de cette session ; interactions tactiles et rendu à confirmer sur le téléphone. Connexion réelle, paiement sans contact test, délai de remontée, carte à débit différé, consentement expiré et réconciliation à tester avant d'activer les données bancaires.
