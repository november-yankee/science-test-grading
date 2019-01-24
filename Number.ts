function _round(number, powerOfTen) {
  const tenToThePower = Math.pow(10, powerOfTen);
  
  const result = Math.round(number/tenToThePower)*tenToThePower;
  
  console.log("_round: number = %s, powerOfTen = %s, result = %s", number, powerOfTen, result);
  
  return result;
}

function _isNaN(number) {
  return number !== number;
}

module.exports = {
  _round: _round,
  _isNaN: _isNaN
};
