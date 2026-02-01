---
# TarotTALKS
this project is a web application that maps the **Rider–Waite–Smith Tarot** to curated **TED and TEDx talks**. it is designed as an exploratory tool for reflection, divination-inspired inquiry, and discovering new ideas through the intersection of symbols and storytelling.

### Live App
👉 [https://tarottalks.app/](https://tarottalks.app/)
[![https://tarottalks.app](https://github.com/bmccall17/TarotTALKS/blob/main/public/applicationhero.png?raw=true)](https://tarottalks.app/)

---
## backstory
TarotTALKS is a project i began in March 2025 during a profoundly challenging chapter of my life. i have been studying and working with Tarot since 1993, and over the years it has remained one of my most trusted tools for grounding and reflection. in recent years i started simplifying with a daily practice of drawing one card, noticing the symbols or patterns on the card, asking my intuition, maybe reading a book or turning to a podcast to learn more. its really all about noticing how i, me specifically, am impacted by the card and what Tarot is saying to me right now, today!

to navigate that difficult season, i returned to that simple daily practice of drawing one Tarot card but i started adding the practice of watching a TED or TEDx talk that aligned with the archetype of that card. day by day, the pattern grew clearer. the themes in the cards echoed the themes in the talks: constraint, liberation, vulnerability, reinvention, courage, power, healing. i continued mapping these connections intentionally throughout the year and soon i had a full framework linking all 78 cards to talks across the TED ecosystem.

i actually gave a Pecha Kucha talk about this project here in Asheville on December 5, 2025... [and have since hidden it as an easter egg](https://tarottalks.app/cards/knight-of-cups)! which inspired this project to become more than a personal practice... its a dataset, a map, and could become a shared resource for anyone to explore. using Claude Code as my primary development environment, with support from ChatGPT and NotebookLM, i turned the framework into a small Next.js webapp that hosts all 78 card-and-talk pairings, with room to grow through notes, commentary, and expanded metadata. the first version launched on December 9, 2025.

at its core, TarotTALKS is about the art of noticing, pattern recognition, meaning-making, and learning to see your life through multiple lenses at once: ancient and contemporary, symbolic and scientific, internal and external. it is an experiment in learning through symbols, story, and the unexpected conversations between them, and a reminder that sometimes the things we build to save ourselves become things we can offer to others.

---
## card images
the tarot card images are from the beautifully preserved **Pamela A (1909) Rider–Waite–Smith** scans:
[https://www.dungeon.church/rider-waite-smith-tarot-pamela-a-1909/](https://www.dungeon.church/rider-waite-smith-tarot-pamela-a-1909/)

*"Pamela A (1909) Rider–Waite–Smith card scans originally archived by Dungeon Church, from scans of a Japanese collector's deck."*

---
## card sounds
the ritual card interaction sounds are from **SoundDino**:
[https://sounddino.com/en/effects/cards/](https://sounddino.com/en/effects/cards/)
*Royalty-free card sound effects used under SoundDino's free license.*

---
## books & resources
these works informed the historical grounding and interpretive depth of the project:
* Graham, Sasha. **Llewellyn’s Complete Book of the Rider-Waite-Smith Tarot: A Journey Through the History, Meaning, and Use of the World’s Most Famous Deck.** Woodbury, Minnesota: Llewellyn Publications, 2018. ISBN 978-0-7387-5319-5.
* Katz, Marcus, and Tali Goodwin. **Secrets of the Waite-Smith Tarot: The True Story of the World’s Most Popular Tarot.** Woodbury, Minnesota: Llewellyn Publications, 2015. ISBN 978-0-7387-4436-0.
* Cynova, Melissa. **Kitchen Table Tarot: Pull Up a Chair, Shuffle the Cards, and Let’s Talk Tarot.** First Edition. Woodbury, Minnesota: Llewellyn Publications, 2017. ISBN 978-0-7387-5077-4.
* Dore, Jessica. **Tarot for Change: Using the Cards for Self-Care, Acceptance, and Growth.** Illustrated by Xaviera López. New York: Penguin Life (Viking), 2021. ISBN 978-0-593-29593-9.
* Esselmont, Brigit. **Everyday Tarot: Unlock Your Inner Wisdom and Manifest Your Future.** Illustrated by Eleanor Grosch. New York: Running Press, 2018. ISBN 978-0-7624-9280-0.
* Nichols, Sallie. **Tarot and the Archetypal Journey: The Jungian Path from Darkness to Light.** Foreword by Mary K. Greer. Newburyport, MA: Weiser Books, 2019. ISBN 978-1-57863-659-4.
* Pollack, Rachel. **Seventy-Eight Degrees of Wisdom: A Tarot Journey to Self-Awareness.** Third Edition. Newburyport, MA: Weiser Books, 2019. ISBN 978-1-57863-665-5.
* Tea, Michelle. **Modern Tarot: Connecting with Your Higher Self Through the Wisdom of the Cards.** Illustrated by Amanda Verwey. San Francisco: HarperElixir, 2017. ISBN 978-0-06-268240-6.
* Wen, Benebell. **Holistic Tarot: An Integrative Approach to Using Tarot for Personal Growth.** Berkeley, California: North Atlantic Books, 2015. ISBN 978-1-58394-835-4.
* Wintner, Bakara. **WTF Is Tarot? ...& How Do I Do It?** Illustrated by Autumn Whitehurst. Salem, MA: Page Street Publishing Co., 2017. eISBN 978-1-62414-451-6.

---
## branding assets
a standalone icon is available at `public/linktree-icon.svg` for use on external profile links (Linktree, social bios, etc.). the app also generates dynamic icons via `app/icon.tsx` (favicon) and `app/apple-icon.tsx` (180x180 PWA icon).

---
## notes
there are no license restrictions on the application code. please feel free to fork, modify, or build upon the project. if you use the card images, be sure to follow the attribution guidelines from Dungeon Church.
