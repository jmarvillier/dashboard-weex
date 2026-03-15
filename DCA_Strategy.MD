# Stratégie DCA Gradué BTC/USDT

> Stratégie d'accumulation et de distribution adaptée aux cycles Bitcoin.
> Paramètre de base : **10 USDT / jour** (ajustable).

---

## Principe fondateur

Le DCA classique investit le même montant à intervalle fixe, sans tenir compte du prix.
Cette stratégie introduit une **pondération dynamique** : on investit plus quand c'est bon marché,
moins quand c'est cher, et on distribue progressivement quand c'est rentable.

La référence de prix utilisée est toujours le **prix moyen d'achat pondéré** de la position en cours,
recalculé en temps réel à partir du journal de trading.

---

## Phase 1 — Accumulation

Les zones sont calibrées sur la volatilité historique de BTC.
Un écart de 10% est banal en quelques jours ; un bull run dépasse régulièrement +200%.

| Zone | Écart au prix moyen d'achat | Montant déployé | Exemple sur 10 USDT |
|------|-----------------------------|-----------------|---------------------|
| Zone A — Sous la moyenne | < 0% | **100%** | 10 USDT |
| Zone B — Légèrement au-dessus | 0% à +5% | **75%** | 7.5 USDT |
| Zone C — Modérément au-dessus | +5% à +10% | **50%** | 5 USDT |
| Zone D — Nettement au-dessus | +10% à +20% | **25%** | 2.5 USDT |
| Zone E — Seuil bull run atteint | > +20% | **0% — DCA suspendu** | 0 USDT |

> Les seuils 0 / 5 / 10 / 20% correspondent respectivement à 0×, 0.25×, 0.5× et 1× le seuil de profit (20%).
> Ils sont recalculés automatiquement si tu modifies le seuil de profit.

---

## Phase 2 — Gestion de la dette

Chaque période où le montant plein n'est pas déployé génère une **dette** :

```
Dette = Σ (montant_base - montant_déployé) sur toutes les périodes
```

**Règles de la dette :**

- La dette est **remboursée en priorité** dès que le prix repasse sous le prix moyen (Zone A)
- Le **plafond recommandé** est fixé à **30× la mise journalière** (300 USDT sur une base de 10 USDT)
  — soit environ un mois complet sans achat, ce qui est réaliste sur un cycle BTC
- Au-delà du plafond, on force un achat à 100% même si on est au-dessus de la moyenne,
  pour éviter de rater une accumulation trop longtemps

---

## Phase 3 — Distribution (bull run)

Quand le prix dépasse le prix moyen d'achat de **+20%**, le DCA est suspendu.
On passe en mode distribution progressive. Les paliers sont conçus pour couvrir
les amplitudes réelles des bull runs BTC (+100% à +500% depuis un creux).

| Palier | Écart au prix moyen atteint | Action |
|--------|-----------------------------|--------|
| Palier 1 | **+20%** | Vendre **5%** de la position |
| Palier 2 | **+50%** | Vendre **10%** supplémentaires |
| Palier 3 | **+100%** | Vendre **15%** supplémentaires |
| Palier 4 | **+200%** | Vendre **25%** supplémentaires |
| Palier 5 | **+400%** | Vendre **30%** supplémentaires |

> **Important** : les paliers sont cumulatifs et indépendants.
> Si le prix monte directement de +100%, les paliers 1, 2 et 3 se déclenchent tous les trois.
> Il reste toujours une fraction de position ouverte pour capter un dépassement inattendu.
> La somme des ventes sur tous les paliers = **85%** de la position — on garde 15% "pour toujours".

---

## Reprise du DCA après distribution

Le DCA reprend automatiquement quand le prix repasse **sous le prix moyen d'achat recalculé**
après les ventes partielles.

Le nouveau prix moyen est recalculé sur la position restante — les ventes partielles
l'ont potentiellement ajusté à la hausse, ce qui élargit la zone d'accumulation future.

---

## Paramètres configurables

| Paramètre | Valeur par défaut BTC | Description |
|-----------|-----------------------|-------------|
| Montant DCA | 10 USDT | Mise de base par période |
| Période | Jour | Fréquence d'accumulation |
| Seuil bull run | +20% | Déclenchement mode distribution |
| Plafond dette | 300 USDT (30×) | Seuil de forçage d'achat |
| Réserve de trésorerie recommandée | 300 USDT | Cash à maintenir disponible |

---

## Propriétés clés

**Avantages :**
- Mathématiquement cohérente : on achète plus quand c'est moins cher, on vend en profit
- Chaque période a une action claire — même "ne rien faire" est un signal conscient
- La dette empêche d'oublier le capital non déployé
- Symétrique : accumulation forte en bas, distribution progressive en haut
- Les paliers de vente sont définis à froid, avant toute émotion de marché

**Points de vigilance :**
- Nécessite une réserve de trésorerie égale au plafond de dette (300 USDT)
- En bear prolongé, la moyenne baisse progressivement — la patience est la clé
- Les paliers de vente doivent être **paramétrés avant d'entrer en position**
- Ne jamais modifier les paliers de distribution en cours de bull run sous l'effet de la FOMO

---

*Stratégie élaborée avec Claude — à adapter selon ton exposition et ton appétit au risque.*
