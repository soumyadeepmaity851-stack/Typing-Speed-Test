const passages = {
  easy: [
    "A quiet morning can make even a busy day feel simple. Open the window, take a slow breath, and let the soft light fill the room. Small habits often bring the biggest changes.",
    "Maya walked to the market with a cloth bag and a short list. She chose ripe pears, fresh bread, and a bunch of yellow flowers to brighten the kitchen table.",
    "The little dog ran across the green field and came back with a stick. Its ears bounced as it hurried home, ready for another game in the warm afternoon sun.",
    "We made a pot of tea and sat by the window while rain tapped on the roof. The street grew quiet, and the trees looked bright and clean after the shower.",
    "A good book can take you to a new place without leaving your chair. Turn one page, meet a new friend, and let the story lead you somewhere unexpected.",
    "On Saturday, Leo rode his bike along the river path. He waved to a neighbor, watched two ducks cross the water, and stopped to rest beneath a wide old tree.",
    "Fresh fruit, a glass of water, and a few minutes outside can lift your mood. You do not need a big plan to make a small part of the day feel better.",
    "Nina planted mint near the back door so she could pick a few leaves for tea. By the end of summer, the green patch had spread around the edge of the pot.",
    "The train moved past farms, small towns, and fields of flowers. A child by the window counted bridges while her father pointed out a kite high in the blue sky.",
    "After dinner, we cleared the table and played a simple word game. Everyone had a different answer, and soon the room was full of stories and laughter."
  ],
  medium: [
    "When the rain finally stopped, the whole garden seemed to wake up. Drops clung to each leaf, the path smelled of earth, and a small bird began to sing.",
    "“Take your time,” Rowan said, setting the old map on the table. “The best route is not always the shortest one; sometimes the view is worth an extra mile.”",
    "At 7:15 each morning, a baker unlocks the blue door and turns on the lights. By sunrise, warm rolls and cinnamon buns are ready for the first guests.",
    "The museum was nearly empty, so we wandered through the bright rooms without a plan. One painting held our attention: a quiet shore beneath a violet sky.",
    "A useful notebook does not need to be perfect. Write down the question, add one clear idea, then leave a little room for what you discover tomorrow.",
    "“Did you bring the tickets?” Sam asked. I checked my coat, laughed at my own panic, and found them tucked safely inside the book I had carried all day.",
    "The community garden started with three raised beds and a borrowed hose. Now neighbors share tomatoes, swap recipes, and leave fresh herbs for anyone to take.",
    "Even a familiar street can feel new when you walk it slowly. Notice the painted shutters, the tiny shop on the corner, and the names carved into the old gate.",
    "Before the meeting began, Jo wrote three goals on the whiteboard: listen closely, ask better questions, and leave with a plan everyone can explain.",
    "By the time the last guests arrived, the candles had burned low and the soup was ready. Nobody minded the delay; the conversation had made the evening."
  ],
  hard: [
    "At 06:45, the server logged 128 requests; only 3 failed. “Retry job #42,” said Mira, then changed the threshold from 0.8 to 0.95 before the next run.",
    "The code review found two edge cases: an empty list ([]) and a value of -17. Add tests for both, then verify that 3.14 remains unchanged.",
    "“Build v2.4.1 is ready,” Alex typed. The checksum was 9f2a-71c0, the file measured 48 MB, and the release window closed at 23:59 UTC.",
    "A quick formula can be easy to misread: (total + tax) / 4 != total + tax / 4. Use parentheses, name each value, and test the result with $12.50.",
    "At 10:30 a.m., the team compared 18%, 24%, and 31% growth. The final chart used a #2B6CB0 line and labeled each quarter from Q1 to Q4.",
    "“Is this the right path?” asked Noor. She checked /docs/setup.md, ran `npm test`, and saw 42 passing checks with 0 warnings.",
    "The sensor measured 21.6°C at 08:05, then rose by 1.25° before noon. A reading above 25°C triggers alert #TEMP_HIGH; lower values are logged normally.",
    "In the puzzle, A=7, B=14, and C=21; therefore, A+B=C. If the input is null, return an error—not 0—and include the request ID.",
    "The invoice listed 5 items: cables ($8.99), a hub ($24.50), and 3 adapters ($4.25 each). Total: $46.24, paid by card ending in 3081.",
    "At 80 km/h, the trip takes 1.5 hours; at 100 km/h, it takes 1.2. The difference is 18 minutes, assuming traffic stays near 0."
  ]
};

export function getPassage(difficulty = "medium", duration = 30) {
  const level = passages[difficulty] ? difficulty : "medium";
  const pool = passages[level];
  const desiredLength = Math.max(380, Math.ceil(Number(duration) * 9));
  const chosen = [];
  let length = 0;

  while (length < desiredLength) {
    const next = pool[Math.floor(Math.random() * pool.length)];
    chosen.push(next);
    length += next.length + 1;
  }

  return {
    text: chosen.join(" "),
    label: `${level.toUpperCase()} · ${level === "easy" ? "EVERYDAY WORDS" : level === "medium" ? "SENTENCES" : "NUMBERS & SYMBOLS"}`
  };
}

export function getDifficultyOptions() {
  return Object.keys(passages);
}
