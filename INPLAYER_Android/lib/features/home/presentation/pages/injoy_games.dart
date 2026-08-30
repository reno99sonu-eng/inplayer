class InJoyGame {
  final String id;
  final String title;
  final String developer;
  final String thumbnail;

  const InJoyGame({
    required this.id,
    required this.title,
    required this.developer,
    required this.thumbnail,
  });
}

const inJoyGames = <InJoyGame>[
  InJoyGame(
    id: 'car-evolution',
    title: 'Car Evolution Game',
    developer: 'SKY HIGH STUDIO',
    thumbnail:
        'https://img.gamemonetize.com/rrflwl9gzd8jw3wpk6mzgwfzi32pvnlp/512x384.jpg',
  ),
  InJoyGame(
    id: 'jungle-tube-sort',
    title: 'Jungle Tube Sort',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/gc27b80jq4qszm6es9mqtmy8fyavty8l/512x384.jpg',
  ),
  InJoyGame(
    id: 'scale-the-depths',
    title: 'Scale the Depths',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/vdyzczweogljzhl0f47jjbrfx87ja163/512x384.jpg',
  ),
  InJoyGame(
    id: 'stormhawk',
    title: 'STORMHAWK',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/xluntt2g2ij4zf2lrthjozqe4vhx8qi3/512x384.jpg',
  ),
  InJoyGame(
    id: 'farming-simulation',
    title: 'Farming Simulation Game',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/4wqbtp9q2umsv9k703yokgau6c8abtra/512x384.jpg',
  ),
  InJoyGame(
    id: 'rasgullas',
    title: 'Rasgullas',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/bgvootmi3hf47pyn2osbshsbvnhxy2ui/512x384.jpg',
  ),
  InJoyGame(
    id: 'bump-the-balls',
    title: 'Bump the Balls',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/1pb39gu1lkx49o8ng8yga0wh3ceyupfz/512x384.jpg',
  ),
  InJoyGame(
    id: 'football-legends-puzzle',
    title: 'Football Legends Sliding Puzzle',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/i0gwshzyncwhxd9q9hyprkrn7b0fwhrz/512x384.jpg',
  ),
  InJoyGame(
    id: 'police-transport',
    title: 'Police Transport Game',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/sn3ro971fse3r2cuk735a3depwknvlgy/512x384.jpg',
  ),
  InJoyGame(
    id: 'tuk-tuk-auto',
    title: 'Tuk Tuk Auto Rikshaw',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/e3nqbd83zbz64dri00qtgftk6ke4reds/512x384.jpg',
  ),
  InJoyGame(
    id: 'offroad-truck',
    title: 'Offroad Truck Driving Game',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/xtiazo4pxkvapm95lenz2ig6mwrdaqks/512x384.jpg',
  ),
  InJoyGame(
    id: 'sugar-drop',
    title: 'Sugar Drop',
    developer: 'GameMonetize',
    thumbnail:
        'https://img.gamemonetize.com/hruvokintdgntinvmcz1rf1n10ajp3b3/512x384.jpg',
  ),
];

/// Stable rotation: every two UTC days all clients see the same new order.
List<InJoyGame> getRotatedInJoyGames() {
  final period =
      DateTime.now().toUtc().millisecondsSinceEpoch ~/
      const Duration(days: 2).inMilliseconds;
  final offset = period % inJoyGames.length;
  return [...inJoyGames.skip(offset), ...inJoyGames.take(offset)];
}
