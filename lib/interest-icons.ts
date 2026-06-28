import {
  Music,
  Guitar,
  Piano,
  Mic,
  Headphones,
  Gamepad2,
  Code,
  Terminal,
  Cpu,
  Bot,
  Brain,
  BookOpen,
  GraduationCap,
  Palette,
  Brush,
  PenTool,
  Feather,
  Camera,
  Clapperboard,
  Film,
  Drama,
  Dumbbell,
  Bike,
  Mountain,
  Trophy,
  Medal,
  Footprints,
  PersonStanding,
  Snowflake,
  FerrisWheel,
  Rocket,
  Atom,
  FlaskConical,
  Microscope,
  Dna,
  Stethoscope,
  Calculator,
  Telescope,
  Globe,
  Languages,
  Map,
  Compass,
  Plane,
  Ship,
  Anchor,
  Tent,
  ChefHat,
  Utensils,
  Coffee,
  Cake,
  Sprout,
  Leaf,
  Flower,
  Tractor,
  Dog,
  Cat,
  Bird,
  Fish,
  Waves,
  Shirt,
  Scissors,
  Hammer,
  Wrench,
  Car,
  Dices,
  Puzzle,
  Sword,
  Newspaper,
  Megaphone,
  Briefcase,
  Landmark,
  TrendingUp,
  Coins,
  PiggyBank,
  Scale,
  Gavel,
  Heart,
  Gem,
  Crown,
  Wand2,
  Sun,
  Star,
  type LucideIcon,
} from "lucide-react";

// Each entry: keywords that map to an icon. Matching (see iconForInterest) is
// WORD-based, not naive substring, so "ai" no longer matches "mountAIn".
//  - a keyword with a space is matched as a substring of the whole phrase
//    (e.g. "mountain bike", "roller coaster")
//  - a keyword of length <= 3 must equal a whole word ("ai", "ml", "dj")
//  - a longer keyword matches a word that STARTS with it ("bik" → "biking")
// First matching entry wins, so order specific before general. Multi-word and
// more-specific entries are placed earlier where collisions are likely.
const MAP: { keywords: string[]; icon: LucideIcon }[] = [
  // Cycling first (so "mountain biking" beats "mountain").
  { keywords: ["mountain bike", "mountain biking", "bike", "biking", "bikes", "cycling", "cycle", "bicycl", "spin class"], icon: Bike },

  // Music & audio
  { keywords: ["guitar"], icon: Guitar },
  { keywords: ["piano", "keyboard"], icon: Piano },
  { keywords: ["sing", "singing", "vocal", "choir", "karaoke", "acappella"], icon: Mic },
  { keywords: ["kpop", "k-pop", "music", "song", "songwrit", "band", "orchestra", "violin", "cello", "drum", "jazz", "musician"], icon: Music },
  { keywords: ["podcast", "audio", "headphone", "music production"], icon: Headphones },

  // Tech
  { keywords: ["robot", "robotics"], icon: Bot },
  { keywords: ["ai", "ml", "machine learning", "artificial intelligence", "neural", "data science", "deep learning"], icon: Brain },
  { keywords: ["coding", "code", "programming", "developer", "software", "web dev", "hackathon", "app dev"], icon: Code },
  { keywords: ["terminal", "linux", "devops", "command line"], icon: Terminal },
  { keywords: ["computer", "hardware", "electronics", "circuit", "arduino", "raspberry"], icon: Cpu },
  { keywords: ["gaming", "gamer", "video game", "minecraft", "roblox", "fortnite", "esports", "playstation", "xbox", "nintendo"], icon: Gamepad2 },

  // Games & puzzles
  { keywords: ["chess", "strategy", "board game", "dungeons", "tabletop", "poker", "card game"], icon: Dices },
  { keywords: ["puzzle", "rubik", "sudoku", "crossword"], icon: Puzzle },

  // Reading / learning / writing
  { keywords: ["reading", "book", "novel", "literature", "manga", "comic"], icon: BookOpen },
  { keywords: ["writing", "writer", "poetry", "poem", "blog", "journal", "screenwrit", "story"], icon: Feather },
  { keywords: ["news", "current events"], icon: Newspaper },
  { keywords: ["debate", "speech", "model un", "public speaking", "toastmaster"], icon: Megaphone },
  { keywords: ["school", "studying", "academic", "tutoring", "teaching", "teacher", "education", "scholar"], icon: GraduationCap },

  // Art & media
  { keywords: ["painting", "paint", "art", "arts", "drawing", "draw", "sketch", "illustrat", "doodl"], icon: Palette },
  { keywords: ["design", "graphic", "ux", "ui design"], icon: Brush },
  { keywords: ["calligraphy", "lettering", "handwriting"], icon: PenTool },
  { keywords: ["photo", "photography", "photographer"], icon: Camera },
  { keywords: ["filmmak", "video editing", "youtube", "vlog", "videograph"], icon: Clapperboard },
  { keywords: ["movie", "film", "cinema", "anime", "netflix"], icon: Film },
  { keywords: ["theater", "theatre", "drama", "acting", "improv", "musical theater"], icon: Drama },
  { keywords: ["dance", "dancing", "ballet", "choreo", "hip hop"], icon: PersonStanding },

  // Sports & fitness
  { keywords: ["gym", "fitness", "workout", "weightlift", "strength", "crossfit", "bodybuild"], icon: Dumbbell },
  { keywords: ["hiking", "hike", "climbing", "climb", "mountaineer", "mountain", "bouldering", "backpacking"], icon: Mountain },
  { keywords: ["running", "run", "track", "marathon", "jogging", "cross country", "trail run"], icon: Footprints },
  { keywords: ["swimming", "swim", "surfing", "surf", "water polo", "sailing", "kayak", "rowing", "diving", "paddle"], icon: Waves },
  { keywords: ["skiing", "ski", "snowboard", "skating", "skate", "ice hockey", "hockey", "snow", "winter sport"], icon: Snowflake },
  { keywords: ["yoga", "pilates", "meditation", "martial art", "karate", "taekwondo", "judo", "gymnastics", "cheer"], icon: PersonStanding },
  { keywords: ["soccer", "football", "basketball", "tennis", "baseball", "volleyball", "sports", "golf", "lacrosse", "rugby", "cricket", "softball", "badminton", "fencing", "pickleball"], icon: Trophy },
  { keywords: ["competition", "championship", "olympic", "tournament"], icon: Medal },
  { keywords: ["roller coaster", "amusement park", "theme park", "carnival"], icon: FerrisWheel },

  // Science
  { keywords: ["space", "astronomy", "rocket", "rockets", "nasa", "aerospace"], icon: Rocket },
  { keywords: ["physics", "science", "quantum"], icon: Atom },
  { keywords: ["chemistry", "lab", "experiment"], icon: FlaskConical },
  { keywords: ["biology", "microbio", "microscope"], icon: Microscope },
  { keywords: ["genetics", "dna", "genomics", "bioinformatics"], icon: Dna },
  { keywords: ["medicine", "medical", "nursing", "health", "doctor", "premed", "anatomy"], icon: Stethoscope },
  { keywords: ["math", "mathematics", "algebra", "calculus", "geometry", "statistics"], icon: Calculator },
  { keywords: ["telescope", "stargazing", "stargaz"], icon: Telescope },

  // World, travel, language
  { keywords: ["travel", "traveling", "flying", "aviation", "pilot"], icon: Plane },
  { keywords: ["boating", "boat", "yacht", "cruise", "naval", "ship"], icon: Ship },
  { keywords: ["fishing", "scuba", "marine"], icon: Anchor },
  { keywords: ["camping", "camp", "outdoors", "scouting", "scout"], icon: Tent },
  { keywords: ["geocaching", "orienteer", "exploring", "adventure"], icon: Compass },
  { keywords: ["geography", "cartograph"], icon: Map },
  { keywords: ["history", "world", "culture", "politics", "social studies"], icon: Globe },
  { keywords: ["language", "languages", "spanish", "french", "chinese", "mandarin", "latin", "japanese", "german", "korean", "linguist"], icon: Languages },

  // Food
  { keywords: ["cooking", "cook", "baking", "bake", "chef", "pastry"], icon: ChefHat },
  { keywords: ["cake", "dessert", "sweets", "candy"], icon: Cake },
  { keywords: ["food", "foodie", "restaurant", "cuisine", "eating"], icon: Utensils },
  { keywords: ["coffee", "tea", "barista", "boba"], icon: Coffee },

  // Nature & animals
  { keywords: ["gardening", "garden", "planting", "plants"], icon: Sprout },
  { keywords: ["farming", "farm", "ranch", "homestead"], icon: Tractor },
  { keywords: ["nature", "environment", "sustainability", "ecology", "conservation"], icon: Leaf },
  { keywords: ["flower", "floral", "botany", "botanic"], icon: Flower },
  { keywords: ["dog", "dogs", "puppy", "puppies", "canine"], icon: Dog },
  { keywords: ["cat", "cats", "kitten", "feline"], icon: Cat },
  { keywords: ["bird", "birds", "birding", "parrot"], icon: Bird },
  { keywords: ["fish", "fishkeep", "aquarium", "reef"], icon: Fish },

  // Making & building
  { keywords: ["fashion", "clothing", "styling", "modeling"], icon: Shirt },
  { keywords: ["sewing", "knitting", "crochet", "crafting", "crafts", "quilting", "embroidery"], icon: Scissors },
  { keywords: ["woodworking", "carpentry", "maker", "building", "construction"], icon: Hammer },
  { keywords: ["repair", "fixing", "engineering", "tinkering", "mechanic"], icon: Wrench },
  { keywords: ["cars", "car", "automotive", "racing", "motorsport", "karting"], icon: Car },

  // Business & money
  { keywords: ["finance", "economics", "banking"], icon: Landmark },
  { keywords: ["investing", "invest", "stocks", "trading", "crypto", "markets"], icon: TrendingUp },
  { keywords: ["money", "budgeting", "saving", "accounting"], icon: Coins },
  { keywords: ["entrepreneur", "startup", "business", "founder", "venture"], icon: PiggyBank },
  { keywords: ["marketing", "advertising", "branding", "sales"], icon: Megaphone },
  { keywords: ["consulting", "career", "professional"], icon: Briefcase },

  // Civics & misc
  { keywords: ["law", "legal", "lawyer", "justice", "court"], icon: Scale },
  { keywords: ["government", "policy", "advocacy"], icon: Gavel },
  { keywords: ["volunteering", "volunteer", "charity", "community", "nonprofit", "service"], icon: Heart },
  { keywords: ["fantasy", "rpg", "lego", "warhammer", "cosplay"], icon: Sword },
  { keywords: ["magic", "wizard", "harry potter"], icon: Wand2 },
  { keywords: ["jewelry", "gems", "rocks", "minerals", "collecting"], icon: Gem },
  { keywords: ["royal", "medieval", "history buff"], icon: Crown },
  { keywords: ["weather", "astrology", "horoscope"], icon: Sun },
];

export function iconForInterest(name: string): LucideIcon {
  const lower = name.toLowerCase();
  const words = lower.split(/[^a-z0-9+#]+/).filter(Boolean);
  for (const { keywords, icon } of MAP) {
    for (const k of keywords) {
      if (k.includes(" ")) {
        if (lower.includes(k)) return icon;
      } else if (k.length <= 3) {
        if (words.includes(k)) return icon;
      } else if (words.some((w) => w.startsWith(k))) {
        return icon;
      }
    }
  }
  return Star;
}
