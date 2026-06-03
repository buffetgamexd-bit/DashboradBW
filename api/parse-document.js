export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, images } = req.body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'La API Key de Anthropic (Claude) no está configurada.' });
    }

    const systemPrompt = `Eres un asistente experto en analizar documentos corporativos, contratos y propuestas comerciales. 
Tu tarea es extraer información clave del texto o de las imágenes provistas y formatearla estrictamente en formato JSON sin explicaciones adicionales.`;

    const userPrompt = `Analiza el documento provisto (contrato, propuesta u orden de compra) y extrae la información del cliente.
    
Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (no agregues formato markdown, no uses \`\`\`json ni agregues comentarios o texto extra):
{
  "nombre": "Nombre del cliente o empresa",
  "sector": "Ej: Energía, Telecomunicaciones, Consultoría, Media, Proyectos Inmob., etc. (extrae el sector o industria del cliente, si no está claro pon 'Otro')",
  "responsable": "Jesus" o "Alonso" o "Johana" o "Marisol" o "" (deja vacío si no se menciona a ninguno de ellos),
  "monto": 120000,
  "tipo_pago": "Pago único" o "A plazos (X mensualidades)" o "A plazos (X pagos)",
  "descripcion": "Resumen de max 12 palabras del servicio o alcance" o null
}

Reglas para la extracción:
1. "nombre": Extrae el nombre oficial del cliente.
2. "sector": Extrae la industria o sector a la que pertenece el cliente.
3. "responsable": Si se menciona a 'Jesus', 'Alonso', 'Johana' o 'Marisol' (por ejemplo en firmas, testigos, representantes o cuentas de correo), selecciónalo. Si no se menciona o no está claro, pon "".
4. "monto": Extrae el valor total del contrato o de la inversión inicial. Si es a plazos o pago mensual, pon el monto mensual inicial. Debe ser un número puro sin comas ni símbolos (ej: 60000). Si no encuentras ningún monto, pon 0.
5. "tipo_pago": Si el documento indica pago mensual, recurrente, a mensualidades, cuotas, fee mensual o vigencia de varios meses con pagos periódicos, extrae e indica el detalle de plazos o mensualidades si se menciona, ej: "A plazos (12 mensualidades)", "A plazos (6 mensualidades)", "A plazos (3 pagos)". Si es a plazos pero no se especifica cuántos, pon simplemente "A plazos". Si es un pago en una sola exhibición, único o de contado, pon "Pago único".
6. "descripcion": Resume brevemente para qué es el servicio (ej: "Consultoría reputacional", "Manejo de menciones en medios", "Servicios de comunicación"). Máximo 12 palabras.`;

    // Armar el contenido del mensaje según si recibimos texto o imágenes
    let messageContent = [];

    if (images && Array.isArray(images) && images.length > 0) {
      // Caso Multimodal: Procesar páginas renderizadas como imágenes
      images.forEach((imgBase64, idx) => {
        messageContent.push({
          type: 'text',
          text: `[Página ${idx + 1}]`
        });
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: imgBase64
          }
        });
      });
      messageContent.push({
        type: 'text',
        text: userPrompt
      });
    } else if (text && text.trim() !== '') {
      // Caso de texto normal (DOCX / TXT)
      messageContent.push({
        type: 'text',
        text: `Documento a analizar:\n"""\n${text}\n"""\n\n${userPrompt}`
      });
    } else {
      return res.status(400).json({ error: 'No se recibió texto ni imágenes del documento.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Error de Anthropic:', errText);
      return res.status(response.status).json({ error: `Error de la API de Anthropic: ${errText}` });
    }

    const data = await response.json();
    const claudeResponse = data.content[0].text.trim();

    // Intentar parsear el JSON recibido de Claude
    let resultJSON;
    try {
      resultJSON = JSON.parse(claudeResponse);
    } catch (e) {
      // Intento de limpieza de Markdown por si Claude agrega bloques de código
      const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultJSON = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Claude no devolvió un JSON estructurado válido.');
      }
    }

    return res.status(200).json(resultJSON);

  } catch (error) {
    console.error('Request Error:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}
