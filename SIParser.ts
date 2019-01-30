/**
 * Normalizes SI units into fundamental SI units (eg g, m, s) so it's easier to compare different representations (eg '50 kPa',
 * '50*10^3 kg/(m*s^2)', '5.0*10^4 kg*m^-1*s^-2').
 *
 * BNF grammar:
 *
 * <expression> ::= <magnitude> <term>
 *                  | <magnitude> <asterix-term>
 *                  | <magnitude> <slash-term>
 *                  | <magnitude>
 *
 * <magnitude> ::= <significand> *10^ <exponent>
 *
 * <significand> ::= <decimal>
 *
 * <term> ::= ( <term> )
 *            | <factor> <asterix-term>
 *            | <factor> <slash-term>
 *            | <factor>
 *
 *
 * <asterix-term> ::= * <term>
 *
 * <slash-term> ::= / <term>
 *
 * <factor> ::= <base>
 *              | <base> ^ <exponent>
 *
 * <base> ::= <base-unit>
 *            | <prefix> <base-unit>
 *            | <derived-unit>
 *            | <prefix> <derived-unit>
 *
 * <prefix> ::= Y | Z | E | P | T | G | M | k | da | d | c | m | μ | n | p | f | a | z | y
 *
 * <base-unit> ::= m | g | s | A | K | mol | cd
 *
 * <derived-unit> ::= rad | sr | Hz | N | Pa | J | W | C | V | F | Ω | S | Wb | T | H | °C | lm | lx | Bq | Gy | Sv | kat
 *
 * <per-unit> ::= % | ppm | ppb
 *
 * <exponent> ::= <integer>
 *
 * <integer> ::= + <digits>
 *               | - <digits>
 *               | <digits>
 *
 * <decimal> ::= + <digits> . <digits>
 *               | - <digits> . <digits>
 *               | <digits> . <digits>
 *
 * <digits> ::= 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
 **/
function normalizeUnits(string) {
  const normalizeUnitsResult = _throttle(_normalizeUnits, Array.prototype.slice.call(arguments));
  console.log(`_normalizeUnits: normalizeUnitsResult = ${JSON.stringify(normalizeUnitsResult)}`);
  
  if (normalizeUnitsResult.success) {
    const magnitudeString = normalizeUnitsResult.result.magnitude;
    const unitsString = normalizeUnitsResult.result.units;

    return magnitudeString === '' && unitsString === ''
        ? ''
        : magnitudeString + (unitsString === '%' || unitsString === '' ? '' : ' ') + unitsString;
  } else {
    throw new Error(`Unable to parse after '${normalizeUnitsResult.consumed}' in '${string}'. Are you sure metric units are being used?`);
  }
}

function _normalizeUnits(string) {
  const failureResult = {
    rest: string,
    success: false
  };
  
  if (typeof(string) !== 'string') {
    throw new Error(`'${JSON.stringify(string)}' must be of type string but is of type '${typeof(string)}'.`);
  }
  
  string = string.split(' ').join('');
  
  if (string === '') {
    return {
      consumed: '',
      rest: '',
      result: {
        magnitude: '',
        units: ''
      },
      success: true
    };
  }
  
  const expressionResult = _parseExpression(string);
  console.log(`_normalizeUnits: expressionResult = ${JSON.stringify(expressionResult)}`);
  
  if (expressionResult.success) {
    const magnitude = expressionResult.result.magnitude;
    const exponents = expressionResult.result.exponents;

    const units = [ '10', 'g', 'm', 's', 'A', 'K', 'cd', 'mol', '%', 'ppm', 'ppb', 'ppt', 'ppq' ].filter((unit) => {
      return exponents.hasOwnProperty(unit);
    });
    
    const magnitudeString = JSON.stringify(magnitude) + (exponents['10'] !== 0
      ? '*10^' + exponents['10']
      : '');
    const unitsString = units.filter((unit) => {
      return unit !== '10';
    }).map((unit) => {
      return unit + (exponents[unit] !== 1
        ? '^' + exponents[unit]
        : '');
    }).join('*');
    console.log(`_normalizeUnits: magnitudeString = ${magnitudeString}`);

    return {
      consumed: expressionResult.consumed,
      rest: expressionResult.rest,
      result: {
        magnitude: magnitudeString,
        units: unitsString
      },
      success: true
    };
  } else {
    failureResult['consumed'] = expressionResult.consumed;
  }
  
  return failureResult;
}

/**
 * <expression> ::= <magnitude> <term>
 *                  | <magnitude> <asterix-term>
 *                  | <magnitude> <slash-term>
 *                  | <magnitude>
 *                  | <term>
 **/
function _parseExpression(string) {
  const failureResult = {
    rest: string,
    success: false
  };
  
  const magnitudeResult = _parseMagnitude(string);
  console.log(`_parseExpression: magnitudeResult = ${JSON.stringify(magnitudeResult)}`);
  
  if (magnitudeResult.success || magnitudeResult.consumed === '') {
    if (magnitudeResult.rest) {
      const operator = magnitudeResult.rest[0] === '*'
          ? '*'
          : magnitudeResult.rest[0] === '/'
          ? '/'
          : '';
      const rest = magnitudeResult.rest.substring(operator === ''
          ? 0
          : 1);
      
      const termResult = _parseTerm(rest);
      console.log(`_parseExpression: termResult = ${JSON.stringify(termResult)}`);
      
      const consumed = magnitudeResult.consumed + operator + termResult.consumed;
      
      if (termResult.success) {
        const exponents = termResult.result.exponents;
        if (operator === '/') {
          Object.keys(exponents).forEach((key) => {
            exponents[key] = -exponents[key];
          })
        }
        if (magnitudeResult.success) {
          exponents['10'] += magnitudeResult.result.exponent;
        }

        // FIXME: This is the wrong thing to do for '/'.
        return {
          consumed: consumed,
          rest: termResult.rest,
          result: {
            magnitude: magnitudeResult.success
                ? termResult.result.conversion(magnitudeResult.result.significand)
                : NaN,
            exponents: exponents
          },
          success: true
        };
      } else {
        failureResult['consumed'] = consumed;
      }
    } else {
      return {
        consumed: magnitudeResult.consumed,
        rest: magnitudeResult.rest,
        result: {
          magnitude: magnitudeResult.result.significand,
          exponents: {
            '10': magnitudeResult.result.exponent
          }
        },
        success: true
      };
    }
  } else {
    failureResult['consumed'] = magnitudeResult.consumed;
  }
  
  return failureResult;
}

/**
 * <magnitude> ::= <significand> 
 *                 | <significand> *10^ <exponent>
 *                 | <significand> E <exponent>
 *                 | <significand> e <exponent>
 **/
function _parseMagnitude(string) {
  const failureResult = {
    rest: string,
    success: false
  };
  
  const significandResult = _parseSignificand(string);
  console.log(`_parseMagnitude: significandResult = ${JSON.stringify(significandResult)}`);
  
  if (significandResult.success) {
    const operator = significandResult.rest.indexOf('*10^') === 0
        ? '*10^'
        : significandResult.rest.charAt(0) === 'E' || significandResult.rest.charAt(0) === 'e'
        ? significandResult.rest[0]
        : undefined;
    if (operator !== undefined) {
      const exponentResult = _parseExponent(significandResult.rest.substring(operator.length));
      console.log(`_parseMagnitude: exponentResult = ${JSON.stringify(exponentResult)}`);
      
      const consumed = significandResult.consumed + operator + exponentResult.consumed;
      
      if (exponentResult.success) {  
        return {
          consumed: consumed,
          rest: string.substring(consumed.length),
          result: {
            significand: significandResult.result,
            exponent: exponentResult.result
          },
          success: true
        };
      } else {
        failureResult['consumed'] = consumed;
      }
    } else {
      return {
        consumed: significandResult.consumed,
        rest: significandResult.rest,
        result: {
          significand: significandResult.result,
          exponent: 0
        },
        success: true
      };
    }
  } else {
    failureResult['consumed'] = significandResult.consumed;
  }
  
  return failureResult;
}

/**
 * <significand> ::= <decimal>
 **/
function _parseSignificand(string) {
  return _parseDecimal(string);
}

/**
 * <term> ::= ( <term> )
 *            | <factor> <asterix-term>
 *            | <factor> <slash-term>
 *            | <factor>
 **/
function _parseTerm(string) {
  const failureResult = {
    rest: string,
    success: false
  };
  
  const openParenthesisResult = _parseChar(string, '(');
  console.log(`_parseTerm: openParenthesisResult = ${JSON.stringify(openParenthesisResult)}`);
  
  if (openParenthesisResult.success) {
    const termBetweenParenthesesResult = _parseTerm(openParenthesisResult.rest);
    console.log(`_parseTerm: termBetweenParenthesesResult = ${JSON.stringify(termBetweenParenthesesResult)}`);
    
    if (termBetweenParenthesesResult.success) {
      const closeParenthesisResult = _parseChar(termBetweenParenthesesResult.rest, ')');
      console.log(`_parseTerm: closeParenthesisResult = ${JSON.stringify(closeParenthesisResult)}`);
      
      const consumedInclusiveBetweenParentheses = openParenthesisResult.consumed + termBetweenParenthesesResult.consumed + closeParenthesisResult.consumed;
      
      if (closeParenthesisResult.success) {
        return {
          consumed: consumedInclusiveBetweenParentheses,
          rest: closeParenthesisResult.rest,
          result: termBetweenParenthesesResult.result,
          success: true
        };
      } else {
        failureResult['consumed'] = consumedInclusiveBetweenParentheses;
      }
    } else {
      failureResult['consumed'] = openParenthesisResult.consumed + termBetweenParenthesesResult.consumed;
    }
  } else {
    const factorResult = _parseFactor(string);
    console.log(`_parseTerm: factorResult = ${JSON.stringify(factorResult)}`);
    
    if (factorResult.success) {
      const factorExponents = factorResult.result.exponents;
      const factorConversion = factorResult.result.conversion;
      
      const asterixTermResult = _parseAsterixTerm(factorResult.rest);
      console.log(`_parseTerm: asterixTermResult = ${JSON.stringify(asterixTermResult)}`);
      
      const consumedAroundAsterix = factorResult.consumed + asterixTermResult.consumed;
        
      if (asterixTermResult.success) {
        const asterixTermExponents = asterixTermResult.result.exponents;
        const asterixTermConversion = asterixTermResult.result.conversion;
        
        const exponentsAfterAsterix = factorExponents;
        Object.keys(asterixTermExponents).forEach((termKey) => {
          exponentsAfterAsterix[termKey] = (exponentsAfterAsterix[termKey] || 0) + asterixTermExponents[termKey];
        })
        
        return {
          consumed: consumedAroundAsterix,
          rest: asterixTermResult.rest,
          result: {
            exponents: exponentsAfterAsterix,
            conversion: (magnitude) => {
              return factorConversion(asterixTermConversion(magnitude));
            }
          },
          success: true
        };
      } else {
        const slashTermResult = _parseSlashTerm(factorResult.rest);
        console.log(`_parseTerm: slashTermResult = ${JSON.stringify(slashTermResult)}`);
        
        const consumedAroundSlash = factorResult.consumed + slashTermResult.consumed;
          
        if (slashTermResult.success) {
          const slashTermExponents = slashTermResult.result.exponents;
          const slashTermConversion = slashTermResult.result.conversion;
          
          const exponentsAfterSlash = factorExponents;
          Object.keys(slashTermExponents).forEach((termKey) => {
            exponentsAfterSlash[termKey] = (exponentsAfterSlash[termKey] || 0) - slashTermExponents[termKey];
          })
            
          return {
            consumed: consumedAroundSlash,
            rest: slashTermResult.rest,
            result: {
              exponents: exponentsAfterSlash,
              conversion: (magnitude) => {
                // FIXME: This is incorrect for division.
                return factorConversion(slashTermConversion(magnitude));
              }
            },
            success: true
          };
        } else {
          return factorResult;
        }
      }
    } else {
      failureResult['consumed'] = factorResult.consumed;
    }
  }
                                           
  return failureResult;
}

/**
 * <asterix-term> ::= * <term>
 **/
function _parseAsterixTerm(string) {
  return _parseCharTerm(string, '*');
}

/**
 * <slash-term> ::= / <term>
 **/
function _parseSlashTerm(string) {
  return _parseCharTerm(string, '/');
}

function _parseCharTerm(string, char) {
  const failureResult = {
    rest: string,
    success: false
  };
  
  const charResult = _parseChar(string, char);
  console.log(`_parseCharTerm: charResult = ${JSON.stringify(charResult)}`);
  
  if (charResult.success) {
    const termResult = _parseTerm(charResult.rest);
    console.log(`_parseCharTerm: termResult = ${JSON.stringify(termResult)}`);
    
    const consumed = charResult.consumed + termResult.consumed;
    
    if (termResult.success) {
      return {
        consumed: consumed,
        rest: termResult.rest,
        result: termResult.result,
        success: true
      };
    } else {
      failureResult['consumed'] = consumed;
    }
  } else {
    failureResult['consumed'] = charResult.consumed;
  }

  return failureResult;
}

/**
 * <factor> ::= <base>
 *              | <base> ^ <exponent>
 **/
function _parseFactor(string) {
  const failureResult = {
    rest: string,
    success: false
  };
  
  const baseResult = _parseBase(string);
  console.log(`parseFactor: baseResult = ${JSON.stringify(baseResult)}`);
  
  if (baseResult.success) {
    const exponents = baseResult.result.exponents;
    
    const caretResult = _parseChar(baseResult.rest, '^');
    console.log(`_parseFactor: caretResult = ${JSON.stringify(caretResult)}`);
    
    if (caretResult.success) {
      const exponentResult = _parseExponent(caretResult.rest);
      console.log(`_parseFactor: exponentResult = ${JSON.stringify(exponentResult)}`);
      
      const consumedAroundCaret = baseResult.consumed + caretResult.consumed + exponentResult.consumed;
      
      if (exponentResult.success) {
        const exponent = exponentResult.result;
        
        // TODO: Use something like `mapEntry`
        Object.keys(exponents).forEach((key) => {
          exponents[key] *= exponent;
        });
        
        const result = {
          consumed: consumedAroundCaret,
          rest: exponentResult.rest,
          result: {
            exponents: exponents,
            conversion: baseResult.result.conversion
          },
          success: true
        };
      
        return result;
      } else {
        failureResult['consumed'] = consumedAroundCaret;
      }
    } else {
      return baseResult;
    }
  } else {
    failureResult['consumed'] = baseResult.consumed;
  }
  
  return failureResult;
}

/**
 * <base> ::= <base-unit>
 *            | <prefix> <base-unit>
 *            | <derived-unit>
 *            | <prefix> <derived-unit>
 *
 * <prefix> ::= Y | Z | E | P | T | G | M | k | da | d | c | m | μ | n | p | f | a | z | y
 *
 * <base-unit> ::= m | g | s | A | K | mol | cd
 *
 * <derived-unit> ::= rad | sr | Hz | N | Pa | J | W | C | V | F | Ω | S | Wb | T | H | °C | lm | lx | Bq | Gy | Sv | kat
 *
 * <per-unit> ::= % | ppm | ppb | ppt | ppq
 **/
function _parseBase(string) {
  const failureResult = {
    rest: string,
    success: false
  };
  
  const prefixes = {
    'Y': 24,
    'Z': 21,
    'E': 18,
    'P': 15,
    'T': 12,
    'G': 9,
    'M': 6,
    'k': 3,
    'h': 2,
    'da': 1,
    '': 0,
    'd': -1,
    'c': -2,
    'm': -3,
    'μ': -6,
    'n': -9,
    'p': -12,
    'f': -15,
    'a': -18,
    'z': -21,
    'y': -24
  };
  const baseUnits = [ 'm', 'g' , 's' , 'A' , 'K' , 'mol' , 'cd' ];
  const derivedUnits = {
    'L': {
      exponents: {
        10: -3,
        m: 3
      },
    },
    'rad': {
      exponents: {}
    },
    'sr': {
      exponents: {}
    },
    'Hz': {
      exponents: {
        s: -1
      }
    },
    'N': {
      exponents: {
        10: 3,
        g: 1,
        m: 1,
        s: -2
      }
    },
    'Pa': {
      exponents: {
        10: 3,
        g: 1,
        m: -1,
        s: -2
      }
    },
    'bar': {
      exponents: {
        10: 8,
        g: 1,
        m: -1,
        s: -2
      }
    },
    'J': {
      exponents: {
        10: 3,
        g: 1,
        m: 2,
        s: -2
      }
    },
    'W': {
      exponents: {
        10: 3,
        g: 1,
        m: 2,
        s: -3
      }
    },
    'C': {
      exponents: {
        s: 1,
        A: 1
      }
    },
    'V': {
      exponents: {
        10: 3,
        g: 1,
        m: 2,
        s: -3,
        A: -1
      }
    },
    'F': {
      exponents: {
        10: -3,
        g: -1,
        m: -2,
        s: 4,
        A: 2
      }
    },
    'Ω': {
      exponents: {
        10: 3,
        g: 1,
        m: 2,
        s: -3,
        A: -2
      }
    },
    'S': {
      exponents: {
        10: -3,
        g: -1,
        m: -2,
        s: 3,
        A: 2
      }
    },
    'Wb': {
      exponents: {
        10: 3,
        g: 1,
        m: 2,
        s: -2,
        A: -1
      }
    },
    'T': {
      exponents: {
        10: 3,
        g: 1,
        s: -2,
        A: -1
      }
    },
    'H': {
      exponents: {
        10: 3,
        g: 1,
        m: 2,
        s: -2,
        A: -2
      }
    },
    '°C': {
      exponents: {
        K: 1
      },
      conversion: (magnitude) => {
        return magnitude + 273.15;
      }
    },
    'lm': { // TODO: multiply by 4π
      exponents: {
        cd: 1
      }
    },
    'lx': { // TODO: conversion
      exponents: {
        m: -2,
        cd: 1
      }
    },
    'Bq': { // TODO: conversion
      exponents: {
        s: -1
      }
    },
    'Gy': { // TODO: conversion
      exponents: {
        m: 2,
        s: -2
      }
    },
    'Sv': { // TODO: conversion
      exponents: {
        m: 2,
        s: -2
      }
    },
    'kat': {
      exponents: {
        mol: 1,
        s: -1
      }
    }
  };
  // TODO: normalize these to have no units
  const perUnits = [ '%', 'ppm', 'ppb', 'ppt', 'ppq' ];
  const prefixlessUnits = perUnits.concat([ '°C' ]);

  const units = baseUnits.concat(perUnits).concat(Object.keys(derivedUnits));
  const match = Object.keys(prefixes)
    .filter((prefix) => {
      return prefix !== '' && string.indexOf(prefix) === 0;
    }).map((prefix) => {
      return units.filter((unit) => {
        const prefixedUnit = prefix + unit;

        return prefixlessUnits.indexOf(unit) === -1 &&
            string.indexOf(prefixedUnit) === 0;
      }).map((unit) => {
        return {
          prefix: prefix,
          unit: unit
        };
      });
    }).reduce((acc, elt) => {
      return acc.concat(elt);
    }, []).concat(units.filter((unit) => {
      return string.indexOf(unit) === 0;
    }).map((unit) => {
      return {
        prefix: '',
        unit: unit
      };
    }))
    .sort((lhs, rhs) => {
      return (rhs.prefix.length + rhs.unit.length) - (lhs.prefix.length + lhs.unit.length);
    });
  
  if (match.length > 0) {
    const prefix = match[0].prefix;
    const unit = match[0].unit;
    const consumed = prefix + unit;
    
    const result = {
      consumed: consumed,
      rest: string.substring(consumed.length),
      result: {
        exponents: {
          10: prefixes[prefix]
        },
        conversion: (magnitude) => {
          return magnitude;
        }
      },
      success: true
    };
    
    if (Object.keys(derivedUnits).indexOf(unit) !== -1) {
      Object.keys(derivedUnits[unit].exponents).forEach((baseUnit) => {
        result.result.exponents[baseUnit] = (result.result.exponents[baseUnit] || 0) + derivedUnits[unit].exponents[baseUnit];
      });
      
      result.result.conversion = derivedUnits[unit].conversion ||
        function (magnitude) {
          return magnitude;
        };
    } else {
      result.result.exponents[unit] = 1;
    }
    
    return result;
  } else {
    failureResult['consumed'] = '';
  }
  
  return failureResult;
}

/**
 * <exponent> ::= <integer>
 **/
function _parseExponent(string) {
  return _parseInteger(string);
}

/**
 * <integer> ::= + <integer>
 *               | - <integer>
 *               | <digits>
 **/
function _parseInteger(string) {
  const failureResult = {
    rest: string,
    success: false
  };
  
  const plusResult = _parseChar(string, '+');
  console.log(`_parseInteger: plusResult = ${JSON.stringify(plusResult)}`);
  
  if (plusResult.success) {
    const integerAfterPlusResult = _parseInteger(plusResult.rest);
    console.log(`_parseInteger: integerAfterPlusResult = ${JSON.stringify(integerAfterPlusResult)}`);
    
    const consumedInclusiveAfterPlus = plusResult.consumed + integerAfterPlusResult.consumed;
    
    if (integerAfterPlusResult.success) {
      return {
        consumed: consumedInclusiveAfterPlus,
        rest: integerAfterPlusResult.rest,
        result: integerAfterPlusResult.result,
        success: true
      };
    } else {
      failureResult['consumed'] = consumedInclusiveAfterPlus;
    }
  } else {
    const minusResult = _parseChar(string, '-');
    console.log(`_parseInteger: minusResult = ${JSON.stringify(minusResult)}`);
    
    if (minusResult.success) {
      const integerAfterMinusResult = _parseInteger(minusResult.rest);
      console.log(`_parseInteger: integerAfterMinusResult = ${JSON.stringify(integerAfterMinusResult)}`);
      
      const consumedInclusiveAfterMinus = minusResult.consumed + integerAfterMinusResult.consumed;
      
      if (integerAfterMinusResult.success) {
        return {
          consumed: consumedInclusiveAfterMinus,
          rest: integerAfterMinusResult.rest,
          result: -integerAfterMinusResult.result,
          success: true
        };
      } else {
        failureResult['consumed'] = consumedInclusiveAfterMinus;
      }
    } else {
      const digitsResult = _parseDigits(string);
      console.log(`_parseInteger: digitsResult = ${JSON.stringify(digitsResult)}`);
      
      if (digitsResult.success) {
        return digitsResult;
      } else {
        failureResult['consumed'] = digitsResult.consumed;
      }
    }
  }
  
  return failureResult;
}

/**
 * <decimal> ::= + <decimal>
 *               | - <decimal>
 *               | <digits> <dot-digits>
 *               | <digits>
 *               | <dot-digits>
 **/
function _parseDecimal(string) {
  const failureResult = {
    rest: string,
    success: false
  };
  
  const plusResult = _parseChar(string, '+');
  console.log(`_parseDecimal: plusResult = ${JSON.stringify(plusResult)}`);
  
  if (plusResult.success) {
    const decimalAfterPlusResult = _parseDecimal(plusResult.rest);
    console.log(`_parseDecimal: decimalAfterPlusResult = ${JSON.stringify(decimalAfterPlusResult)}`);
    
    const consumedInclusiveAfterPlus = plusResult.consumed + decimalAfterPlusResult.consumed;
    
    if (decimalAfterPlusResult.success) {
      return {
        consumed: consumedInclusiveAfterPlus,
        rest: decimalAfterPlusResult.rest,
        result: decimalAfterPlusResult.result,
        success: true
      };
    } else {
      failureResult['consumed'] = consumedInclusiveAfterPlus;
    }
  } else {
    const minusResult = _parseChar(string, '-');
    console.log(`_parseDecimal: minusResult = ${JSON.stringify(minusResult)}`);
    
    if (minusResult.success) {
      const decimalAfterMinusResult = _parseDecimal(minusResult.rest);
      console.log(`_parseDecimal: decimalAfterMinusResult = ${JSON.stringify(decimalAfterMinusResult)}`);
      
      const consumedInclusiveAfterMinus = minusResult.consumed + decimalAfterMinusResult.consumed;
      
      if (decimalAfterMinusResult.success) {
        return {
          consumed: consumedInclusiveAfterMinus,
          rest: decimalAfterMinusResult.rest,
          result: -decimalAfterMinusResult.result,
          success: true
        };
      } else {
        failureResult['consumed'] = consumedInclusiveAfterMinus;
      }
    } else {
      const digitsResult = _parseDigits(string);
      console.log(`_parseDecimal: digitsResult = ${JSON.stringify(digitsResult)}`);
      
      const dotDigitsResult = _parseDotDigits(digitsResult.rest);
      console.log(`_parseDecimal: dotDigitsResult = ${JSON.stringify(dotDigitsResult)}`);
      
      if (dotDigitsResult.success) {
        const consumedAroundPeriod = digitsResult.consumed + dotDigitsResult.consumed;          
        
        return {
          consumed: consumedAroundPeriod,
          rest: dotDigitsResult.rest,
          result: parseFloat(consumedAroundPeriod),
          success: true
        };
      } else {
        return digitsResult;
      }
    }
  }
  
  return failureResult;
}

/**
 * <dot-digits> ::= . <digits>
 **/
function _parseDotDigits(string) {
  const failureResult = {
    rest: string,
    success: false
  };
  
  const periodResult = _parseChar(string, '.');
  console.log(`_parseDotDigits: periodResult = ${JSON.stringify(periodResult)}`);
  
  if (periodResult.success) {
    const digitsAfterPeriodResult = _parseDigits(periodResult.rest);
    console.log(`_parseDotDigits: digitsAfterPeriodResult = ${JSON.stringify(digitsAfterPeriodResult)}`);
    
    const consumedAfterPeriod = periodResult.consumed + digitsAfterPeriodResult.consumed;          
    
    return {
      consumed: consumedAfterPeriod,
      rest: string.substring(consumedAfterPeriod.length),
      result: parseFloat(consumedAfterPeriod),
      success: true
    };
  } else {
    failureResult['consumed'] = periodResult.consumed;
  }
  
  return failureResult;
}

/**
 * <digits> ::= 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
 **/
function _parseDigits(string) {
  const failureResult = {
    consumed: '',
    rest: string,
    success: false
  };
  
  var i;
  for (i = 0; '0' <= string.charAt(i) && string.charAt(i) <= '9'; ++i);

  if (i !== 0) {
    const consumed = string.substring(0, i);

    return {
      consumed: consumed,
      rest: string.substring(i),
      result: parseInt(consumed),
      success: true
    };
  }
  
  return failureResult;
}

function _parseChar(string, char) {  
  if (char === string.charAt(0)) {
    return {
      consumed: char,
      rest: string.substring(1),
      success: true
    };
  } else {
    return  {
      consumed: '',
      rest: string,
      success: false
    };
  }
}

module.exports = {
  _normalizeUnits: _normalizeUnits,
  _parseAsterixTerm: _parseAsterixTerm,
  _parseBase: _parseBase,
  _parseChar: _parseChar,
  _parseCharTerm: _parseCharTerm,
  _parseDecimal: _parseDecimal,
  _parseDigits: _parseDigits,
  _parseDotDigits: _parseDotDigits,
  _parseExponent: _parseExponent,
  _parseExpression: _parseExpression,
  _parseFactor: _parseFactor,
  _parseInteger: _parseInteger,
  _parseMagnitude: _parseMagnitude,
  _parseSignificand: _parseSignificand,
  _parseSlashTerm: _parseSlashTerm,
  _parseTerm: _parseTerm,
  normalizeUnits: normalizeUnits
}