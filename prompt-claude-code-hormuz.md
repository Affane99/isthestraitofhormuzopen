# PROMPT CLAUDE CODE — Site "Is the Strait of Hormuz Open?"

Copie tout ce qui suit dans Claude Code, depuis un dossier vide.

---

## CONTEXTE ET OBJECTIF

Je veux construire un site web single-purpose de type "isitchristmas.com", appelé **"Is the Strait of Hormuz Open?"**. Le site répond à UNE seule question — le détroit d'Ormuz est-il ouvert au trafic commercial ? — avec une réponse géante, un ton légèrement humoristique, et des données réelles en dessous pour la crédibilité.

Contexte géopolitique (juillet 2026) : depuis le 28 février 2026, l'Iran a déclaré le détroit fermé suite aux frappes US/Israël. La situation est ambiguë : route centrale minée, route nord contrôlée par l'Iran (système de permis), route sud dans les eaux omanaises coordonnée par l'US Navy. Le trafic réel oscille entre ~20% et ~65% de la baseline pré-crise (~88 navires/jour selon IMF PortWatch). Le site doit ASSUMER cette ambiguïté au lieu de la cacher — c'est ça le concept humoristique : la vraie réponse est "ça dépend à qui tu demandes".

Positionnement : il existe déjà des dashboards data-heavy (straits.live, hormuzstraitmonitor.com). Mon site n'est PAS un concurrent de ces dashboards. C'est l'anti-dashboard : une page quasi vide, une réponse énorme, un sous-texte drôle, et 4-5 chiffres clés maximum. La cible : quelqu'un qui a vu un titre de presse et veut la réponse en 2 secondes, puis partage le lien.

## STACK TECHNIQUE (non négociable)

- **Next.js 15** (App Router) + **TypeScript strict**
- **Tailwind CSS v4**
- Déploiement cible : **Vercel** (plan gratuit)
- Aucune base de données. Aucun backend séparé. Tout tient dans le repo Next.js.
- Revalidation des données via **ISR** (`revalidate`) + un endpoint `/api/refresh` protégé par secret, appelable par un cron externe (Vercel Cron ou GitHub Actions).
- Pas de librairie UI lourde (pas de shadcn ici, pas de framer-motion sauf si une micro-animation CSS ne suffit pas). Le site doit peser < 100 KB de JS. Vise un score Lighthouse 100/100/100/100.
- Police : une seule variable font via `next/font` (par ex. Inter ou Space Grotesk pour les chiffres géants). Pas de Google Fonts en runtime.

## ARCHITECTURE DES DONNÉES

### Source primaire : IMF PortWatch
- IMF PortWatch publie des données de transit quotidiennes par chokepoint (le détroit d'Ormuz est le "chokepoint6" dans leur dataset). Les données sont hébergées sur leur portail ArcGIS (portwatch.imf.org).
- **Étape obligatoire** : avant de coder l'intégration, VÉRIFIE toi-même l'endpoint exact de l'API ArcGIS/PortWatch (fais un fetch de test, inspecte le schéma JSON réel). Ne code JAMAIS contre un schéma supposé. Si l'API ArcGIS demande une query, documente la query exacte dans un commentaire.
- Données à extraire : nombre de transits quotidiens (navires/jour), date de la dernière donnée disponible. Attention : PortWatch publie avec plusieurs jours de retard (parfois 5-7 jours). Le site doit afficher honnêtement la date de la donnée ("Latest verified data: July 5").

### Fichier de configuration éditorial : `data/status-override.json`
Crée un fichier JSON versionné dans le repo avec ce schéma exact :

```json
{
  "override": null,
  "overrideReason": null,
  "baselineTransitsPerDay": 88,
  "closureDeclaredOn": "2026-02-28",
  "manualFacts": {
    "warRiskInsuranceMultiplier": "8x",
    "majorCarriersSuspended": 8,
    "strandedVesselsApprox": 380,
    "centralChannelMined": true
  },
  "funnySubtexts": {
    "OPEN": ["..."],
    "COMPLICATED": ["..."],
    "CLOSED": ["..."]
  }
}
```

- `override` accepte `null | "OPEN" | "COMPLICATED" | "CLOSED"`. S'il est non-null, il PREND LE PAS sur le calcul automatique (utile si l'actu bouge plus vite que PortWatch — ex : réouverture annoncée, nouvelle attaque). Je mettrai à jour ce fichier à la main via un commit git → redéploiement Vercel automatique.
- `manualFacts` : chiffres mis à jour à la main, affichés dans la section détails.

### Logique de statut (module pur, 100% testé)
Crée `lib/status.ts` avec une fonction pure `computeStatus(transits: number, baseline: number, override: Status | null): StatusResult` :

- Si `override` non-null → retourner l'override avec `source: "editorial"`.
- Sinon, ratio = transits / baseline :
  - ratio ≥ 0.70 → `OPEN`
  - 0.20 ≤ ratio < 0.70 → `COMPLICATED`
  - ratio < 0.20 → `CLOSED`
- Si les données PortWatch sont indisponibles OU datées de plus de 14 jours ET pas d'override → statut `COMPLICATED` avec un flag `stale: true` (le site affiche alors "Honestly? Even we're not sure right now." + la dernière donnée connue).
- Écris des **tests unitaires** (Vitest) couvrant : les 3 seuils, les bornes exactes (0.70 et 0.20), override prioritaire, données stale, transits = 0, baseline = 0 (division par zéro → CLOSED + flag erreur).

### Cache et fraîcheur
- Le fetch PortWatch se fait côté serveur dans un Route Handler ou directement dans le Server Component avec `next: { revalidate: 3600 }` (1h).
- Endpoint `POST /api/refresh` avec header `Authorization: Bearer ${REFRESH_SECRET}` qui appelle `revalidatePath('/')`. Ajoute la config `vercel.json` pour un Vercel Cron qui le déclenche toutes les 6h.
- Toute erreur de fetch → log console + fallback sur les dernières valeurs connues (mets en cache la dernière réponse valide dans le module, et prévois un fallback statique hardcodé dans le repo avec les chiffres du 5 juillet 2026 : 34 transits).

## PAGE PRINCIPALE — SPÉCIFICATION VISUELLE EXACTE

Structure verticale, une seule page (`app/page.tsx`), Server Component :

### 1. Le verdict (100vh, centré)
- La question en petit en haut : "Is the Strait of Hormuz open?" (text-lg, gris moyen).
- LA RÉPONSE en énorme, plein centre : typographie massive, `clamp(4rem, 18vw, 14rem)`, font-weight 800 :
  - `OPEN` → "YES." en vert (#16a34a)
  - `COMPLICATED` → "SORT OF." en ambre (#d97706)
  - `CLOSED` → "NO." en rouge (#dc2626)
- Juste en dessous, le **sous-texte drôle** (text-xl, italique, gris) : une ligne piochée ALÉATOIREMENT côté serveur dans `funnySubtexts[status]` du JSON. Écris 5 lignes par statut, en anglais, ton pince-sans-rire. Exemples de ton à suivre (tu peux les reprendre et en écrire d'autres du même calibre) :
  - CLOSED : "Well, Iran says no, Washington says yes, and the insurers say 8x the normal premium. So: no." / "Technically there's water. Boats are another story." / "Day {N} of 'it's complicated', except now it's just closed."
  - COMPLICATED : "It's open the way a haunted house is open." / "Depends which route, which government spokesperson, and which day of the week." / "Schrödinger's strait: simultaneously open and closed until a tanker observes it."
  - OPEN : "Yes! For now. Refresh tomorrow." / "Open. The insurers remain unconvinced, but open."
  - INTERDIT : toute blague sur les marins bloqués, les morts, ou les nationalités. L'humour vise l'absurdité géopolitique et bureaucratique, jamais les victimes. C'est une ligne rouge.
- Un compteur discret : "Day {N} since the closure declaration (Feb 28, 2026)" — calculé dynamiquement, affiché seulement si statut ≠ OPEN.
- Une flèche/chevron animé (CSS pur) invitant à scroller.

### 2. Section "The actual numbers" (fond légèrement contrasté)
Une grille de 4 cartes maximum, minimalistes (bordure fine, pas d'ombre) :
1. **Transits** : "{X} ships/day vs ~88 normal" + mini barre de progression.
2. **War-risk insurance** : "{multiplier} the pre-crisis price".
3. **Major carriers** : "{N} of the 9 largest have suspended or rerouted via the Cape".
4. **Last verified data** : date PortWatch + mention "IMF PortWatch".
Sous la grille, une ligne : "Why 'sort of' is a legitimate answer →" qui déplie (details/summary HTML natif, pas de JS) 3 phrases expliquant les 3 routes (centrale minée / nord permis iranien / sud eaux omanaises).

### 3. Footer
- Disclaimer sérieux, une phrase : "This site is for general information and mild amusement. It is NOT navigational, insurance, or trading advice. Mariners: consult official maritime advisories."
- "Data: IMF PortWatch · Status logic is open source" + lien GitHub.
- Bouton "Share" utilisant l'API Web Share native avec fallback copy-to-clipboard (seul JS client de la page, dans un petit Client Component isolé).

### Design global
- Dark mode par défaut suivant `prefers-color-scheme`, avec les deux thèmes soignés.
- Fond : subtile texture ou dégradé radial très discret, pas de stock photo, pas d'image de bateau cheap.
- Micro-animation : le verdict apparaît avec un léger fade+scale CSS (`@media (prefers-reduced-motion)` respecté).
- Mobile-first : le verdict doit être parfait sur un écran 360px.

## SEO ET PARTAGE (critique pour ce type de site)

- `generateMetadata` dynamique : title = "Is the Strait of Hormuz Open? {YES/SORT OF/NO} — Live Status", description incluant les transits du jour.
- **Open Graph image dynamique** via `opengraph-image.tsx` (ImageResponse de next/og) : fond couleur du statut, la réponse géante, le compteur de jours. C'est l'élément le plus important pour la viralité — soigne-le.
- JSON-LD `FAQPage` avec la question "Is the Strait of Hormuz open?" et la réponse courante.
- `robots.txt`, `sitemap.ts`, canonical.
- Page 404 dans le thème : "This page is closed. Unlike the strait, that's not up for debate."

## QUALITÉ ET LIVRAISON

1. Initialise le projet proprement (`create-next-app`, TypeScript, Tailwind, ESLint).
2. Commence par `lib/status.ts` + ses tests. Fais tourner les tests AVANT de faire l'UI.
3. Puis l'intégration PortWatch (avec vérification réelle de l'endpoint — si tu n'arrives pas à joindre l'API depuis l'environnement, code l'adaptateur avec le fallback statique et note clairement dans le README ce qu'il reste à vérifier).
4. Puis la page, section par section.
5. Vérifie le build (`next build`) sans erreur ni warning TypeScript.
6. README complet : comment changer l'override (édition du JSON + commit), comment configurer `REFRESH_SECRET` et le cron Vercel, comment ajouter des sous-textes drôles, architecture du calcul de statut avec les seuils.
7. Ne mets AUCUNE clé API dans le code. Variables d'environnement documentées dans `.env.example`.

## CE QUE JE NE VEUX PAS

- Pas de dashboard complexe, pas de graphiques temporels, pas de carte interactive (v1).
- Pas de newsletter, pas de cookies, pas d'analytics dans la v1.
- Pas de contenu inventé : si un chiffre n'est pas dans PortWatch ou dans `manualFacts`, il n'apparaît pas.
- Pas d'humour sur les victimes (voir la ligne rouge plus haut).

Travaille étape par étape, montre-moi le plan avant de commencer, et demande-moi confirmation avant d'installer des dépendances au-delà du strict nécessaire.
