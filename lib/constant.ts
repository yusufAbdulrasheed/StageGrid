export interface EventType {
    title: string;
    image: string;
    slug: string;
    date: string;
    time: string;
    location: string;
    description: string;
  }
  
  export const events: EventType[] = [
    {
      title: "Google I/O Extended 2025",
      image: "/images/event1.png",
      slug: "google-io-extended-2025",
      date: "May 15, 2025",
      time: "10:00 AM PST",
      location: "San Francisco, CA (Virtual + In-Person)",
      description:
        "A global developer event exploring the latest updates in Android, Web, AI, and cloud technologies from Google."
    },
    {
      title: "React Summit 2025",
      image: "/images/event2.png",
      date: "June 20, 2025",
      slug: "react-summit-2025",
      time: "9:00 AM GMT",
      location: "Amsterdam, Netherlands",
      description:
        "The biggest React conference in the world, bringing together frontend engineers to learn about React, Next.js, and modern web development."
    },
    {
      title: "Next.js Conf 2025",
      image: "/images/event3.png",
      date: "October 7, 2025",
      slug: "nextjs-conf-2025",
      time: "12:00 PM EST",
      location: "New York City, USA",
      description:
        "A conference dedicated to Next.js, Vercel, and the future of modern full-stack JavaScript."
    },
    {
      title: "GitHub Universe 2025",
      image: "/images/event4.png",
      date: "November 12, 2025",
      slug: "github-universe-2025",
      time: "9:30 AM PST",
      location: "San Francisco, CA",
      description:
        "GitHub’s annual developer experience conference focusing on AI-powered development, open-source collaboration, and DevOps workflows."
    },
    {
      title: "Africa Tech Festival",
      image: "/images/event5.png",
      date: "November 24, 2025",
      slug: "africa-tech-festival-2025",
      time: "10:00 AM WAT",
      location: "Cape Town, South Africa",
      description:
        "Africa’s leading tech event bringing together industry leaders, innovators, and developers shaping the future of technology on the continent."
    },
    {
      title: "Lagos Developer Meetup – JavaScript Edition",
      image: "/images/event6.png",
      date: "March 8, 2025",
      slug: "lagos-developer-meetup-javascript-edition",
      time: "3:00 PM WAT",
      location: "Yaba, Lagos, Nigeria",
      description:
        "A vibrant meetup for JavaScript developers exploring Node.js, React, Next.js, and real-world engineering challenges."
    },
    {
      title: "ETHGlobal Hackathon – Paris",
      image: "/images/event4.png",
      date: "July 12–14, 2025",
      slug: "ethglobal-hackathon-paris",
      time: "All Day",
      location: "Paris, France",
      description:
        "One of the biggest blockchain hackathons in the world, bringing builders together to create decentralized applications and Web3 tools."
    },
    {
      title: "Women in Tech Global Conference 2025",
      image: "/images/event2.png",
      date: "April 10, 2025",
      slug: "women-in-tech-global-conference-2025",
      time: "2:00 PM GMT",
      location: "Virtual Event",
      description:
        "A worldwide conference empowering women in STEM, featuring keynote speakers, workshops, and networking for developers and leaders."
    }
  ];
  