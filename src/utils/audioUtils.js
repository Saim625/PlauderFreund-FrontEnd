/**
 * Calculates the Root Mean Square (RMS) volume level of a 16-bit PCM audio buffer.
 * RMS is a good approximation of the perceived loudness of the audio signal.
 * * @param {Int16Array} buffer The audio data as a 16-bit integer array.
 * @returns {number} The RMS value (between 0.0 and 1.0, where 1.0 is max volume).
 */
export function calculateRms(buffer) {
  if (buffer.length === 0) return 0;

  // Sum the squares of all samples
  let sumOfSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    // Normalize the sample value by dividing by the max possible value (32767 for Int16)
    const normalizedSample = buffer[i] / 32767.0;
    sumOfSquares += normalizedSample * normalizedSample;
  }

  // Calculate the mean of the squares
  const meanSquare = sumOfSquares / buffer.length;

  // Return the square root of the mean (RMS)
  return Math.sqrt(meanSquare);
}
