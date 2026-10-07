# Money Bubble

App : https://bulles-depenses.theopro1.chatgpt.site

Dépôt : https://github.com/tdi-rosa/-Money-buble

Le code est maintenant sur ce GitHub. Les tests tournent automatiquement après un push. La publication du site reste une étape distincte : ce dépôt n'est pas encore relié à un hébergeur à déploiement automatique.

PWA personnelle en français, conçue pour visualiser les dépenses quotidiennes sur Android/Fairphone. Version 0.1.0 : démonstration interactive et import JSON local. **La connexion bancaire n'est pas encore implémentée ni activée.**

## Utilisation

Ouvrir le site dans Chrome sur Android puis utiliser « Installer l'application » ou « Ajouter à l'écran d'accueil ». L'installation et le mode hors ligne doivent être vérifiés sur le téléphone ; la protection privée de l'hébergement peut affecter le service worker. Les achats fictifs sont signalés et ne sont jamais mélangés aux imports. Les données importées et notes sont enregistrées uniquement dans le navigateur, sans chiffrement applicatif. Ne pas considérer cette version comme un coffre bancaire sécurisé.

Une bulle représente une dépense positive, sa surface est proportionnelle au montant. Même échelle entre les journées, déterminée par l'ensemble des données chargées. Avec beaucoup de données ou un montant exceptionnel, les petites bulles deviennent peu lisibles : utiliser la liste. Les revenus, remboursements et devises autres que l'euro ne sont pas pris en charge par cet import initial.

## Développement et mises à jour

Application sans dépendances ni compilation : les fichiers servis sont dans `dist/`. Lancer `npm test` et `npm run check`. Pour servir localement : `python3 -m http.server 8080 --directory dist`. Publier la nouvelle version après chaque modification. Incrémenter le nom du cache dans `dist/sw.js`, la version dans `package.json` et l'affichage de version. Une notification propose de charger la nouvelle version ; vérifier les mises à jour à chaque retour dans l'app. Le dépôt contient le code et aucun historique bancaire ni secret.

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

Tests automatiques des montants, dates, imports et placement. Pas de validation navigateur ni téléphone dans cette session. Connexion réelle, paiement sans contact test, délai de remontée, carte à débit différé, consentement expiré et réconciliation à tester avant d'activer les données bancaires.
