import { Hono } from "hono";
import { cors } from "hono/cors";
import qs from "qs";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(cors());

app.get("/weather", async (c) => {
  const req = c.req.raw;
  const url = new URL(req.url);
  const queryParams = qs.parse(url.search, { ignoreQueryPrefix: true });
  const res = (await fetch(
    `https://api.openweathermap.org/data/3.0/onecall?units=${
      queryParams.units ?? "metric"
    }&lat=${req.cf?.latitude}&lon=${
      req.cf?.longitude
    }&appid=${c.env.WEATHER_API_KEY}`,
  )) as Response;
  if (!res.ok) {
    return c.json(
      {
        error: "Weather information could not be fetched",
      },
      { status: 500 },
    );
  }
  const body = (await res.json()) as any;

  const convertWeather = (weather: any[]) => {
    const [{ icon, main, description }] = weather;
    return {
      weather: main as string,
      description: description as string,
      thumbnail_url: `https://openweathermap.org/img/wn/${icon}.png`,
      image_url: `https://openweathermap.org/img/wn/${icon}@4x.png`,
    };
  };

  const getDetails = (data: any) => {
    return {
      sunrise: data.sunrise as number,
      sunset: data.sunset as number,
      feels_like: data.feels_like as number,
      pressure: data.pressure as number,
      humidity: data.humidity as number,
      dew_point: data.dew_point as number,
      uvi: data.uvi as number,
      clouds: data.clouds as number,
      visibility: data.visibility as number,
      wind_speed: data.wind_speed as number,
      wind_deg: data.wind_deg as number,
    };
  };

  const latitude = (req.cf?.latitude as string | undefined) ?? "N/A";
  const longitude = (req.cf?.longitude as string | undefined) ?? "N/A";
  const country = (req.cf?.country as string | undefined) ?? "N/A";
  const city = (req.cf?.city as string | undefined) ?? "N/A";
  const hourly = (body.hourly as any[]).map((hourly) => ({
    datetime: new Date((hourly.dt as number) * 1000),
    temperature: hourly.temp as number,
    ...convertWeather(hourly.weather),
    details: getDetails(hourly),
  }));
  const daily = (body.daily as any[]).map((daily) => ({
    datetime: new Date((daily.dt as number) * 1000),
    temperature: daily.temp.day as number,
    ...convertWeather(daily.weather),
    details: getDetails(daily),
  }));
  return c.json(
    {
      latitude,
      longitude,
      country,
      city,
      temperature: body.current.temp as number,
      ...convertWeather(body.current.weather),
      details: getDetails(body.current),
      hourly,
      daily,
    },
    {
      status: 200,
      headers: { "Cache-Control": `public, max-age=60` },
    },
  );
});

export default app;
