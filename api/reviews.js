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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: "Le service d'avis n'est pas encore configuré." });
  }

  let url;
  try {
    url = new URL("/rest/v1/reviews", supabaseUrl);
  } catch (error) {
    console.error("Invalid SUPABASE_URL configuration", error);
    return res.status(500).json({ error: "La configuration du service d'avis est invalide." });
  }

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: "application/json"
  };
  let body;

  if (req.method === "GET") {
    url.search = new URLSearchParams({
      select: "id,name,drone_model,rating,message,created_at",
      order: "created_at.desc",
      limit: "100"
    }).toString();
  } else {
    const review = req.body;
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

    url.search = new URLSearchParams({
      select: "id,name,drone_model,rating,message,created_at"
    }).toString();
    headers["Content-Type"] = "application/json";
    headers.Prefer = "return=representation";
    body = JSON.stringify({
      name: review.name.trim(),
      drone_model: review.drone_model?.trim() || null,
      rating: review.rating,
      message: review.message.trim(),
      publication_consent: true
    });
  }

  let upstream;
  try {
    upstream = await fetch(url, { method: req.method, headers, body });
  } catch (error) {
    console.error("Supabase reviews request failed", error);
    return res.status(502).json({ error: "Le service d'avis est momentanément indisponible." });
  }

  if (!upstream.ok) {
    console.error("Supabase reviews request failed with status", upstream.status);
    return res.status(502).json({ error: "Impossible de charger ou d'enregistrer l'avis pour le moment." });
  }

  const result = await upstream.json();
  return res.status(req.method === "POST" ? 201 : 200).json(req.method === "POST" ? result[0] : result);
};
