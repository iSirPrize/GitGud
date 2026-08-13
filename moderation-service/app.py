# moderation-service/app.py
# Standalone Python microservice that screens user-submitted text for toxic content
# before it is written to Firestore. Called by CommentSection.jsx via fetch()
# prior to every comment and reply post.
#
# Stack: Flask (HTTP server) + flask-cors (allow requests from the React dev server)
#        + Detoxify (PyTorch NLP model trained on Wikipedia/Civil Comments data)
#
# Run:  python app.py
# Port: 5001  (set VITE_MODERATION_URL=http://localhost:5001 in the React .env)
import os

from detoxify import Detoxify
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# Allow cross-origin requests from the React frontend (Vite dev server or production domain)
CORS(app)

# Load the Detoxify model once at startup — this is intentionally at module level
# so the heavy PyTorch weights are only read from disk once, not on every request.
# "original" is the smallest/fastest model; swap for "multilingual" if you need
# non-English support.
model = Detoxify("original")

# Score thresholds per category — a comment is blocked if ANY category meets or
# exceeds its threshold. Values are 0.0–1.0 (probability of that category being present).
# Lower = stricter.  Current values are a reasonable starting point:
#   - toxicity / obscene / insult: 0.7  (permissive, avoids false positives on mild language)
#   - severe_toxicity / threat / identity_attack: 0.5  (tighter, these are higher-severity)
# Tune these based on how your moderation logs look in production.
THRESHOLDS = {
    "toxicity": 0.7,
    "severe_toxicity": 0.5,
    "obscene": 0.7,
    "threat": 0.5,
    "insult": 0.7,
    "identity_attack": 0.5,
}


@app.route("/moderate", methods=["POST"])
def moderate():
    """
    POST /moderate
    Body: { "text": "<user submitted comment>" }

    Returns:
        allowed    (bool)  — True if the text passes all thresholds
        violations (dict)  — categories that exceeded their threshold and their scores
        scores     (dict)  — raw scores for all categories (useful for logging/tuning)

    Called by CommentSection.jsx before addDoc() for both comments and replies.
    If the service is unreachable, the frontend fails open and allows the post
    so a service outage doesn't lock users out of commenting.
    """
    data = request.get_json()
    text = data.get("text", "").strip()

    # Empty text has nothing to moderate — let the frontend validation handle it
    if not text:
        return jsonify({"allowed": True})

    # Run the NLP model — returns a dict of category -> numpy float32
    scores = model.predict(text)

    # Convert numpy float32 values to plain Python floats so jsonify can serialise them
    scores = {k: float(v) for k, v in scores.items()}

    # Collect whichever categories breached their threshold
    violations = {k: scores[k] for k in THRESHOLDS if scores[k] >= THRESHOLDS[k]}

    return jsonify(
        {
            "allowed": len(violations) == 0,
            "violations": violations,  # returned so the frontend could show specific reasons if needed
            "scores": scores,  # full scores for debugging / future logging
        }
    )


@app.route("/health", methods=["GET"])
def health():
    """
    GET /health
    Simple liveness check — useful for Docker health checks or uptime monitors.
    """
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
