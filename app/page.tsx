import EventCards from "@/components/EventCards"
import ExploreBtn from "@/components/ExploreBtn"
import { events } from "@/lib/constant"

const page = () => {
  return (
    <section>
      <h1 className="text-center">The Hub to Every Dev <br/> You Can't Miss</h1>
      <p className="text-center mt-5">Join us for a day of learning, building, and connecting with other developers.</p>
      <div>
        <ExploreBtn/>
      </div>

      <div className="mt-20 space-y-7">
        <h3>Featured Events</h3>

        <ul className="events">
          {events.map((event) =>(
            <li key={event.title}>
              <EventCards {...event}/>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default page
