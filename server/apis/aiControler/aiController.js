const { GoogleGenAI } = require("@google/genai");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const main = async (req, res) => {
  if (!req.body.prompt) {
    res.send({
      message: "prompt is required",
      status: 403,
      success: false,
    });
  } else {
    try {
         let prompt=req.body.prompt +" according to Ecommerce Website Guide"

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      console.log(response.text);

      res.send({
        message: response.text,
        status: 200,
        success: true,
      });
    } catch (err) {
      res.send({
        message: err,
        status: 500,
        success: false,
      });
    }
  }
};

module.exports = {
  main,
};
