"use client"
import Image from "next/image"
import posthog from 'posthog-js'
const ExploreBtn = ()=>{
    return(
        <button type="button" id="explore-btn" className="mt-7 mx-auto" onClick={()=> {
            posthog.capture('explore_events_button_clicked', { target_section: '#events' })
            console.log("Explore Button Clicked")
        }}>
            <a href="#events">Explore Events
                <Image src="/icons/arrow-down.svg" alt="Explore Events" width={24} height={24} />
            </a>
        </button>
    )
}

export default ExploreBtn