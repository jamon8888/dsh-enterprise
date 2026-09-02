"""Package `ict` — Integrated Causal Trajectories.

Couche experimentale legere posee a cote de PyPhi pour la serie ICT
(cf. Epic #4588). Hors numpy/matplotlib, le package ne depend de rien :
simulations, trajectoires et metriques fonctionnent sans PyPhi, qui n'est
sollicite que pour les calculs IIT stricts sur de petits systemes.

Strate 1 (tri = morphogenese minimale) : modele de tri auto-organise
(self-sorting arrays), d'apres Zhang, Goldstein & Levin, "Classical sorting
algorithms as a model of morphogenesis", Adaptive Behavior 2025
(arXiv:2401.05375), pont vers la causal emergence (Hoel ; Jansma & Hoel 2025).

Strate 2 (morphogenese dynamique) : paysages d'attracteurs et signaux
precurseurs sur un vrai modele a bifurcation pli (``bistable`` + ``early_warning``,
notebook ICT-8 ; May 1977 ; Scheffer et al. 2009), puis **agence morphologique** :
reparation de forme apres ablation par reaction-diffusion (``reaction_diffusion``
+ ``agency``, notebook ICT-9 ; Gray & Scott 1983 ; Pearson 1993 ; Mordvintsev
et al. 2020 ; Levin).

Strate 3 (agentivite et valence) : morphodynamique strategique et signature
de valence (``strategic_morphodynamics``, ``valence``, ``multiscale_agency``,
``catastrophe``, notebooks ICT-11..13 ; Axelrod 1984 ; Thom 1972).

Strate 4 (energie libre) : le principe d'energie libre comme lecture unifiee
de l'agentivite morphologique (``free_energy``, notebook ICT-14 ; Friston).

Strate 5 (theorie fondatrice cross-substrat) : compression et longueur de
description minimale (``compression``, ``mdl``, ``epsilon_machine`` ;
Crutchfield ; Hoel), dynamique de features en panel (``feature_dynamics``,
notebook ICT-20) et synthese (``synthesis``). La fleche du temps /
reversibilisation (ICT-18) y outille retrospectivement la signature
thermodynamique de l'agentivite.

Strate 5 (capstone jumeau anthropique) : la **fronce de Thom** comme
micro-analogue du desalignement emergent (``persona_cusp``, notebook
ICT-23 ; Epic #4588 / #5104). Le substrat est un agent dont l'identite
(p) est un parametre d'ordre, pilote par la recompense (b) et la charge
semantique (a = -transgression * charge). L'inoculation `charge -> 0`
aplatit la fronce et supprime la bistabilite : c'est la prediction P0
d'#5104 (Anthropic arXiv:2511.18397, OpenAI arXiv:2506.19823).

Strate 5 (canonicite scalaire ICT-15b) : transposition du theoreme de
Huang 2019 au zoo ICT (``spectral`` + ``sensitivity`` ; ICT-15b #7288 /
Epic #4588). ``spectral`` pose le substrat canonique (graphe de
transition symmetrise ``W = (P + P^T)/2``, matrice de courants nets
antisymetrique, Laplacien, gap spectral). ``sensitivity`` definit la
sensibilite locale ``s_x(f)`` sur ce graphe et un test de la
conjecture type-Huang ``s_max >= sqrt(deg_proxy)`` avec verdict
honnete `consistent` / `inconsistent` / `inconclusive`.
"""

from . import (
    agency,
    argumentation,
    beauty,
    bistable,
    bridge_testing,
    catastrophe,
    causal_emergence,
    cech_obstruction,
    collective_adoption,
    compression,
    concept_inoculation,
    early_warning,
    epsilon_machine,
    feature_dynamics,
    free_energy,
    inhibited_action,
    inhibited_invention,
    jlens_traces,
    learned_valence,
    lens_agreement,
    mdl,
    meta_proxy,
    multiscale_agency,
    persona_cusp,
    phat_self_reference,
    pregnance_animat,
    reaction_diffusion,
    reversibility_budget,
    sae_traces,
    salience_valence_dissociation,
    scale_free,
    sensitivity,
    signaling_convention,
    sorting_metrics,
    spectral,
    stake,
    strategic_morphodynamics,
    symbol_invention,
    synthesis,
    time_arrow,
    tpm_estimation,
    trajectories,
    triade,
    valence,
    workspace,
)
from .bistable import GrazingModel
from .kin_sorting import KinSortingArray
from .reaction_diffusion import GrayScott
from .self_sorting import ALGOTYPES, Cell, Probe, SelfSortingArray

__all__ = [
    "ALGOTYPES",
    "Cell",
    "GrayScott",
    "GrazingModel",
    "KinSortingArray",
    "Probe",
    "SelfSortingArray",
    "agency",
    "argumentation",
    "beauty",
    "bistable",
    "bridge_testing",
    "catastrophe",
    "causal_emergence",
    "cech_obstruction",
    "collective_adoption",
    "compression",
    "concept_inoculation",
    "early_warning",
    "epsilon_machine",
    "feature_dynamics",
    "free_energy",
    "inhibited_action",
    "inhibited_invention",
    "jlens_traces",
    "learned_valence",
    "lens_agreement",
    "mdl",
    "meta_proxy",
    "multiscale_agency",
    "persona_cusp",
    "phat_self_reference",
    "pregnance_animat",
    "reaction_diffusion",
    "reversibility_budget",
    "sae_traces",
    "salience_valence_dissociation",
    "scale_free",
    "sensitivity",
    "signaling_convention",
    "sorting_metrics",
    "spectral",
    "stake",
    "strategic_morphodynamics",
    "symbol_invention",
    "synthesis",
    "time_arrow",
    "tpm_estimation",
    "trajectories",
    "triade",
    "valence",
    "workspace",
]
