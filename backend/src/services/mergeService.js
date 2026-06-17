const logger = require('../config/logger');

const VARIABLE_REGEX = /\{([a-z0-9_]+)\}/g;

class MergeService {

  extractVariables(contenido) {
    if (!contenido) return [];
    const matches = new Set();
    let match;
    while ((match = VARIABLE_REGEX.exec(contenido)) !== null) {
      matches.add(match[1]);
    }
    return Array.from(matches);
  }

  merge(contenido, datos) {
    if (!contenido) return { resultado: '', variablesSinValor: [] };

    const variables = this.extractVariables(contenido);
    const variablesSinValor = [];

    let resultado = contenido;
    for (const v of variables) {
      const valor = datos[v];
      if (valor === undefined || valor === null || valor === '') {
        variablesSinValor.push(v);
      } else {
        resultado = resultado.replace(
          new RegExp(`\\{${v}\\}`, 'g'),
          String(valor)
        );
      }
    }

    return { resultado, variablesSinValor };
  }

  validate(contenido, datos) {
    const variables = this.extractVariables(contenido);
    const faltantes = variables.filter(
      v => datos[v] === undefined || datos[v] === null || datos[v] === ''
    );
    return {
      valid: faltantes.length === 0,
      total: variables.length,
      proporcionadas: variables.length - faltantes.length,
      faltantes,
    };
  }

  resolveContactData(contact) {
    return {
      nombre_cliente: contact?.name || '',
      telefono:       contact?.phone || contact?.whatsapp_id || '',
      email:          contact?.email || '',
      fecha:          new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
  }
}

module.exports = new MergeService();
