export interface FeaturedSlide {
    id: number;
    image: string;
    title: string;
    creator: string;
    isHandle: boolean;
    verified: boolean;
    views: string;
    duration: string;
    objectPosition?: string;
  }
  
  export const featuredSlides: FeaturedSlide[] = [
    {
      id: 0,
      image: "/hero/featured-v2.jpg",
      title: "Horizon",
      creator: "ArjunCreates",
      isHandle: true,
      verified: true,
      views: "12.8M Views",
      duration: "18 min",
      objectPosition: "center",
    },
    {
      id: 1,
      image: "/hero/featured-1.jpg",
      title: "Zero Se Hero",
      creator: "InPlayer",
      isHandle: true,
      verified: true,
      views: "2.1M Views",
      duration: "Coming Soon",
      objectPosition: "center 30%",
    },
    {
      id: 2,
      image: "/hero/featured-2.jpg",
      title: "Off Grid",
      creator: "Maverick Frame",
      isHandle: false,
      verified: false,
      views: "6.4M Views",
      duration: "22 min",
      objectPosition: "center 40%",
    },
    {
      id: 3,
      image: "/hero/featured-3.jpg",
      title: "Low Tide",
      creator: "Qian Shawn",
      isHandle: false,
      verified: false,
      views: "4.8M Views",
      duration: "15 min",
      objectPosition: "center 55%",
    },
    {
      id: 4,
      image: "/hero/featured-4.jpg",
      title: "Untamed",
      creator: "Rafael Peier",
      isHandle: false,
      verified: false,
      views: "9.2M Views",
      duration: "28 min",
      objectPosition: "center 65%",
    },
    {
      id: 5,
      image: "/hero/featured-5.jpg",
      title: "Game Day",
      creator: "Shalva Dekanozishvili",
      isHandle: false,
      verified: false,
      views: "3.5M Views",
      duration: "12 min",
      objectPosition: "center 60%",
    },
  ];