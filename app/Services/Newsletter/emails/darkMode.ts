/**
 * MODE SOMBRE DES E-MAILS — bloc CSS du designer, RECOPIÉ VERBATIM.
 *
 * ⛔ NE PAS RETOUCHER LES VALEURS, et ne pas essayer de le factoriser. C'est la partie délicate
 * des gabarits, testée client par client. Une version qui GÉNÈRE ces règles à partir d'une
 * table serait plus courte et plus élégante — et introduirait exactement le risque qu'on ne
 * veut pas ici : une différence d'un caractère entre ce qui a été testé et ce qui part.
 *
 * Ce fichier existe uniquement pour ne pas en garder trois copies (une par e-mail), qui
 * dériveraient à la première correction.
 *
 * Pourquoi le bloc est écrit TROIS fois avec les mêmes valeurs — ce n'est pas une redondance :
 *
 *   • `@media (prefers-color-scheme:dark)` couvre Apple Mail, iOS, Gmail sur mobile ;
 *   • `[data-ogsc]` / `[data-ogsb]` couvrent Outlook.com et Windows Mail, qui n'honorent PAS la
 *     media query et inversent d'autorité couleurs et fonds, en posant ces attributs sur les
 *     éléments qu'ils touchent. Sans ces deux blocs, ils inversaient le fond sans inverser le
 *     texte — texte sombre sur fond sombre.
 *
 * Tout est en `!important` : ces règles doivent battre les styles en ligne, qui sont la seule
 * façon d'obtenir un rendu fiable en mode clair.
 *
 * SEULE différence avec les mails 1 et 2 du designer : la règle des boutons est celle du mail 3
 * (`.btn a,.btnLight a`), qui est un sur-ensemble. `.btnLight` n'existe que dans le mail 3, la
 * règle est donc sans effet ailleurs et aucune valeur ne change.
 */
export const DARK_MODE_CSS = `  /* ——— MODE SOMBRE — dessiné, pas subi ———————————————————————————————
     Fond brun profond, texte crème, même palette que le mode clair.
     Le code promo est posé sur l'aplat le plus sombre de l'e-mail (#0b0704) :
     c'est, dans les deux modes, le contraste le plus élevé du message.
     Tout est en !important — ces règles doivent battre les styles en ligne.
     Le second bloc rejoue les mêmes valeurs sous [data-ogsc] / [data-ogsb], les
     attributs qu'Outlook.com et Windows Mail posent sur les éléments dont ils
     inversent d'autorité couleur et fond : sans lui, ils inversaient le fond
     sans inverser le texte. */
  @media (prefers-color-scheme:dark){
    body,.bg{background-color:#120c07 !important}
    .card{background-color:#241a12 !important;border-color:#54402f !important}
    .cardDark{background-color:#2a1d13 !important}
    .logo,.logo a{color:#f0e2d6 !important}
    .hero{background-color:#8a4c31 !important}
    .hero .amount{color:#fff3ea !important;text-shadow:2px 3px 0 rgba(0,0,0,0.32) !important}
    .hero .h2{color:#fff3ea !important}
    .hero .heroSub{color:#f7ddd0 !important}
    .band{background-color:#160f09 !important}
    .bandlab{color:#eec3ab !important}
    .bandcode{color:#fffaf5 !important}
    .codebox{background-color:#0b0704 !important;border-color:#e8b79f !important}
    .codebox .code{color:#fffaf5 !important}
    .codebox .codeexp{color:#f0c6ae !important}
    .btn{background-color:#e8b79f !important}
    .btn a,.btnLight a{color:#1c1108 !important}
    .ink{color:#f6ece2 !important}
    .txt,.cond{color:#e3d5c9 !important}
    .cond span{color:#eba98c !important}
    .sub{color:#c6b5a8 !important}
    .fine,.foot{color:#bdaba0 !important}
    .fine a,.foot a{color:#e2d2c6 !important}
    .eyebrow{color:#eba98c !important;border-color:#54402f !important}
    .hair{border-color:#54402f !important}
    .num{background-color:#3b2819 !important;color:#eba98c !important}
    .ph{background-color:#2c1f16 !important;border-color:#6d523f !important;color:#c4ad9c !important}
    .link a{color:#eeb193 !important}
    .note{background-color:#33231a !important;color:#e6d8cc !important}
    .star{color:#eba98c !important}
    .starOff{color:#6f5a4b !important}
    a{color:#eeb193 !important}
  }
    [data-ogsc] body,[data-ogsc] .bg{background-color:#120c07 !important}
    [data-ogsc] .card{background-color:#241a12 !important;border-color:#54402f !important}
    [data-ogsc] .cardDark{background-color:#2a1d13 !important}
    [data-ogsc] .logo,[data-ogsc] .logo a{color:#f0e2d6 !important}
    [data-ogsc] .hero{background-color:#8a4c31 !important}
    [data-ogsc] .hero .amount{color:#fff3ea !important;text-shadow:2px 3px 0 rgba(0,0,0,0.32) !important}
    [data-ogsc] .hero .h2{color:#fff3ea !important}
    [data-ogsc] .hero .heroSub{color:#f7ddd0 !important}
    [data-ogsc] .band{background-color:#160f09 !important}
    [data-ogsc] .bandlab{color:#eec3ab !important}
    [data-ogsc] .bandcode{color:#fffaf5 !important}
    [data-ogsc] .codebox{background-color:#0b0704 !important;border-color:#e8b79f !important}
    [data-ogsc] .codebox .code{color:#fffaf5 !important}
    [data-ogsc] .codebox .codeexp{color:#f0c6ae !important}
    [data-ogsc] .btn{background-color:#e8b79f !important}
    [data-ogsc] .btn a,[data-ogsc] .btnLight a{color:#1c1108 !important}
    [data-ogsc] .ink{color:#f6ece2 !important}
    [data-ogsc] .txt,[data-ogsc] .cond{color:#e3d5c9 !important}
    [data-ogsc] .cond span{color:#eba98c !important}
    [data-ogsc] .sub{color:#c6b5a8 !important}
    [data-ogsc] .fine,[data-ogsc] .foot{color:#bdaba0 !important}
    [data-ogsc] .fine a,[data-ogsc] .foot a{color:#e2d2c6 !important}
    [data-ogsc] .eyebrow{color:#eba98c !important;border-color:#54402f !important}
    [data-ogsc] .hair{border-color:#54402f !important}
    [data-ogsc] .num{background-color:#3b2819 !important;color:#eba98c !important}
    [data-ogsc] .ph{background-color:#2c1f16 !important;border-color:#6d523f !important;color:#c4ad9c !important}
    [data-ogsc] .link a{color:#eeb193 !important}
    [data-ogsc] .note{background-color:#33231a !important;color:#e6d8cc !important}
    [data-ogsc] .star{color:#eba98c !important}
    [data-ogsc] .starOff{color:#6f5a4b !important}
    [data-ogsc] a{color:#eeb193 !important}
    [data-ogsb] body,[data-ogsb] .bg{background-color:#120c07 !important}
    [data-ogsb] .card{background-color:#241a12 !important;border-color:#54402f !important}
    [data-ogsb] .cardDark{background-color:#2a1d13 !important}
    [data-ogsb] .logo,[data-ogsb] .logo a{color:#f0e2d6 !important}
    [data-ogsb] .hero{background-color:#8a4c31 !important}
    [data-ogsb] .hero .amount{color:#fff3ea !important;text-shadow:2px 3px 0 rgba(0,0,0,0.32) !important}
    [data-ogsb] .hero .h2{color:#fff3ea !important}
    [data-ogsb] .hero .heroSub{color:#f7ddd0 !important}
    [data-ogsb] .band{background-color:#160f09 !important}
    [data-ogsb] .bandlab{color:#eec3ab !important}
    [data-ogsb] .bandcode{color:#fffaf5 !important}
    [data-ogsb] .codebox{background-color:#0b0704 !important;border-color:#e8b79f !important}
    [data-ogsb] .codebox .code{color:#fffaf5 !important}
    [data-ogsb] .codebox .codeexp{color:#f0c6ae !important}
    [data-ogsb] .btn{background-color:#e8b79f !important}
    [data-ogsb] .btn a,[data-ogsb] .btnLight a{color:#1c1108 !important}
    [data-ogsb] .ink{color:#f6ece2 !important}
    [data-ogsb] .txt,[data-ogsb] .cond{color:#e3d5c9 !important}
    [data-ogsb] .cond span{color:#eba98c !important}
    [data-ogsb] .sub{color:#c6b5a8 !important}
    [data-ogsb] .fine,[data-ogsb] .foot{color:#bdaba0 !important}
    [data-ogsb] .fine a,[data-ogsb] .foot a{color:#e2d2c6 !important}
    [data-ogsb] .eyebrow{color:#eba98c !important;border-color:#54402f !important}
    [data-ogsb] .hair{border-color:#54402f !important}
    [data-ogsb] .num{background-color:#3b2819 !important;color:#eba98c !important}
    [data-ogsb] .ph{background-color:#2c1f16 !important;border-color:#6d523f !important;color:#c4ad9c !important}
    [data-ogsb] .link a{color:#eeb193 !important}
    [data-ogsb] .note{background-color:#33231a !important;color:#e6d8cc !important}
    [data-ogsb] .star{color:#eba98c !important}
    [data-ogsb] .starOff{color:#6f5a4b !important}
    [data-ogsb] a{color:#eeb193 !important}`
