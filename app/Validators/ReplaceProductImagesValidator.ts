import { schema, CustomMessages, rules } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

// Clone adapté du validator de publication (ExtensionShopifyProductPublisherRequestValidator)
// pour le mode « reimage » : on remplace les images d'un produit EXISTANT, donc productId
// requis, et ni parentCollection ni productType (relus depuis le produit côté serveur).
// Payload MIXTE : chaque entrée est SOIT une nouvelle image (base64Image, + mockupContext
// si mockup) SOIT un média existant conservé tel quel (mediaId — URL, alt et fichier
// intacts sur Shopify). L'exclusivité base64Image/mediaId est contrôlée dans replaceImages().
export default class ReplaceProductImagesValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    images: schema.array([rules.minLength(2)]).members(
      schema.object().members({
        base64Image: schema.string.optional(),
        mediaId: schema.string.optional({}, [rules.regex(/^gid:\/\/shopify\/MediaImage\/\d+$/)]),
        mockupContext: schema.string.optional({}, [rules.minLength(5), rules.maxLength(200)]),
        type: schema.enum(['mockup', 'original'] as const),
        // Passe-partout (poster) : clientId stable par mockup ; sur le jumeau maté,
        // passePartout=true + passePartoutOf=<clientId du mockup source> -> alt/filename réutilisés.
        clientId: schema.string.optional({}, [rules.maxLength(64)]),
        passePartout: schema.boolean.optional(),
        passePartoutOf: schema.string.optional({}, [rules.maxLength(64)]),
      })
    ),
    ratio: schema.enum(['portrait', 'landscape', 'square'] as const),
    productId: schema.string({}, [rules.regex(/^gid:\/\/shopify\/Product\/\d+$/)]),
    idempotencyKey: schema.string.optional(),
    // Choix manuel du front quand le produit n'a pas de metafield artwork.type
    // (vieux produits) ; sinon le type relu du produit fait foi côté serveur.
    productType: schema.enum.optional(['painting', 'poster', 'tapestry'] as const),
  })

  public messages: CustomMessages = {
    'images.required': 'Images array is required',
    'images.minLength': 'At least 2 images are required (mockup + main artwork)',
    'images.*.mediaId.regex': 'mediaId must be a valid Shopify MediaImage GID',
    'images.*.mockupContext.minLength': 'mockupContext must be at least 5 characters',
    'images.*.mockupContext.maxLength': 'mockupContext must not exceed 200 characters',
    'images.*.type.required': 'Each image must have a type',
    'images.*.type.enum': 'Image type must be either mockup or original',
    'ratio.required': 'Ratio is required',
    'ratio.enum': 'Ratio must be portrait, landscape, or square',
    'productId.required': 'Product ID is required',
    'productId.regex': 'Product ID must be a valid Shopify GID',
    'productType.enum': 'productType must be painting, poster or tapestry',
  }

  // NB : pas de « afterValidation » ici — ce n'est pas un hook Adonis 5 (celui du
  // validator publish est du code mort). Les contrôles métier (une seule image
  // « original », mockupContext requis) vivent dans replaceImages(), après validate().
}
