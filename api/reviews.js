const { neon } = require("@neondatabase/serverless");

const MAX_NAME_LENGTH = 60;
const MAX_MODEL_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 1000;

function isText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(503).json({ error: "Le stockage des avis n'est pas encore configuré." });
  }

  let review;
  if (req.method === "POST") {
    review = req.body;
    if (
      !review ||
      typeof review !== "object" ||
      !isText(review.name, MAX_NAME_LENGTH) ||
      !Number.isInteger(review.rating) ||
      review.rating < 1 ||
      review.rating > 5 ||
      !isText(review.message, MAX_MESSAGE_LENGTH) ||
      review.message.trim().length < 10 ||
      (review.drone_model != null && review.drone_model !== "" && !isText(review.drone_model, MAX_MODEL_LENGTH)) ||
      review.publication_consent !== true
    ) {
      return res.status(400).json({ error: "Vérifiez les champs et autorisez la publication de votre avis." });
    }
  }

  try {
    const sql = neon(databaseUrl);
    if (req.method === "GET") {
      const reviews = await sql`
        SELECT id, name, drone_model, rating, message, created_at
        FROM public.reviews
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return res.status(200).json(reviews);
    }

    const [savedReview] = await sql`
      INSERT INTO public.reviews (name, drone_model, rating, message, publication_consent)
      VALUES (
        ${review.name.trim()},
        ${review.drone_model?.trim() || null},
        ${review.rating},
        ${review.message.trim()},
        true
      )
      RETURNING id, name, drone_model, rating, message, created_at
    `;
    return res.status(201).json(savedReview);
  } catch (error) {
    console.error("Neon reviews request failed", error);
    return res.status(502).json({ error: "Impossible de charger ou d'enregistrer les avis pour le moment." });
  }
};
