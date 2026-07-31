const { GoogleGenAI } = require("@google/genai");

/**
 * Scan medical store bill using Google Gemini 2.5 Flash Vision AI.
 * Returns structured JSON with stockist, invoice number, and medicine items.
 * If GEMINI_API_KEY is not configured or an error occurs, returns fallbackToLocal: true.
 */
exports.scanBill = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        success: false,
        fallbackToLocal: true,
        message: "GEMINI_API_KEY not set in backend .env. Using fast local OCR fallback.",
      });
    }

    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: "No image payload provided.",
      });
    }

    // Clean base64 data string if header included
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are an expert OCR parser for Indian pharmacy / medical store bills, purchase invoices, and prescriptions.
Analyze this medical store bill image and extract all details into a clean JSON structure.

Return ONLY a JSON object matching this exact schema (do not include Markdown block markers like \`\`\`json):
{
  "stockist": "Supplier/Distributor Name",
  "invNo": "Invoice Number",
  "invoiceDate": "YYYY-MM-DD",
  "suggestedRotationDeg": 0,
  "items": [
    {
      "name": "Medicine Trade/Brand Name (e.g. Dolo 650mg)",
      "category": "Tablet",
      "batch": "Batch Number",
      "expiryDate": "YYYY-MM-DD",
      "quantity": 10,
      "ptr": 15.50,
      "price": 22.00,
      "discountPercent": 0,
      "gstRate": 5,
      "hsn": "3004",
      "pack": "10 Tabs"
    }
  ]
}

Rules:
1. AUTO ROTATION: The image may be uploaded sideways (90° clockwise, 270° counterclockwise) or upside down. Detect the text orientation. If the text is rotated sideways or upside-down, set "suggestedRotationDeg" to 90, 180, or 270 (the degree rotation needed to make the image upright for human reading). If upright, set 0.
2. "ptr": Purchase rate per pack/unit. If missing on invoice, calculate as ~70% of MRP.
3. "price": MRP per pack/unit.
4. "quantity": Quantity bought.
5. "category": Must be one of ["Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Other"].
6. "expiryDate": Convert 08/28 or Aug-28 to ISO YYYY-MM-DD format (e.g. 2028-08-28).
`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType || "image/jpeg",
              },
            },
          ],
        },
      ],
    });

    const responseText = response?.text || "";
    const jsonString = responseText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let data;
    try {
      data = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse Gemini OCR JSON response:", responseText);
      return res.status(200).json({
        success: false,
        fallbackToLocal: true,
        message: "Gemini Vision output could not be parsed as JSON.",
      });
    }

    const items = Array.isArray(data.items)
      ? data.items.map((item, idx) => ({
          id: Date.now() + idx,
          name: String(item.name || `Medicine ${idx + 1}`).slice(0, 60),
          category: item.category || "Tablet",
          batch: String(item.batch || `B-${100 + idx}`).toUpperCase(),
          expiryDate: item.expiryDate || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
          quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
          ptr: Math.max(0.01, parseFloat(item.ptr) || 0),
          price: Math.max(0.01, parseFloat(item.price) || parseFloat(item.ptr) || 10),
          discountPercent: Math.max(0, parseFloat(item.discountPercent) || 0),
          gstRate: [0, 5, 12, 18, 28].includes(Number(item.gstRate)) ? Number(item.gstRate) : 5,
          hsn: String(item.hsn || "3004"),
          pack: String(item.pack || "1x10"),
          composition: "",
          status: "Active",
        }))
      : [];

    const suggestedRotation = [0, 90, 180, 270].includes(Number(data.suggestedRotationDeg))
      ? Number(data.suggestedRotationDeg)
      : 0;

    return res.status(200).json({
      success: true,
      engine: "Gemini Vision AI ✨",
      suggestedRotationDeg: suggestedRotation,
      stockist: data.stockist || "",
      invNo: data.invNo || "",
      invoiceDate: data.invoiceDate || "",
      items,
    });
  } catch (error) {
    console.error("Gemini OCR Error:", error.message || error);
    return res.status(200).json({
      success: false,
      fallbackToLocal: true,
      message: error.message || "Gemini OCR encountered an issue.",
    });
  }
};
