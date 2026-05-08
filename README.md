Welcome to your new TanStack Start app!

# Getting Started

To run this application with Docker Compose (recommended):

```bash
make up
```

This starts both the app and a local PostgreSQL database. The app will be available at [http://localhost:3000](http://localhost:3000).

To run in host mode (app on host, database in Docker):

```bash
make up      # start the database container
bun install  # install dependencies
bun run dev  # start the dev server
```

# Building For Production

To build this application for production:

```bash
bun run build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
bun run test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the Tailwind import in `src/styles.css` and replace it with your own styles
2. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
3. Uninstall the packages: `bun remove @tailwindcss/vite tailwindcss`

## Tooling

This project uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
bun run lint    # auto-fix lint issues
bun run format  # format code
bun run check   # lint + format in one pass
```

## Database (Docker Compose)

A local PostgreSQL database is provided via Docker Compose.

### Start the stack

```bash
make up
```

This starts:
- **App** container on host port `3000`
- **Postgres** container with persistent storage

### Stop the stack

```bash
make down
```

### View logs

```bash
make logs
```

### Open a shell in the app container

```bash
make shell
```

## Setting up Better Auth

1. Start the database (see above).
2. Generate and set the `BETTER_AUTH_SECRET` environment variable in your `.env.local`:

   ```bash
   bunx @better-auth/cli secret
   ```

3. Visit the [Better Auth documentation](https://www.better-auth.com) to unlock the full potential of authentication in your app.

### Running Migrations

Better Auth uses the same PostgreSQL pool as Drizzle. After starting the database, run:

```bash
bunx @better-auth/cli migrate
```

## Makefile Commands

Common tasks are exposed via the `Makefile`:

| Command | Description |
|---------|-------------|
| `make up` | Start Docker Compose services (app + Postgres) |
| `make down` | Stop Docker Compose services |
| `make logs` | Tail Docker Compose logs |
| `make shell` | Open a shell inside the app container |
| `make install` | Install dependencies with Bun |
| `make dev` | Start the development server (host mode) |
| `make build` | Build for production |
| `make preview` | Preview the production build |
| `make start` | Start the production server |
| `make lint` | Run Biome linter with auto-fix |
| `make format` | Run Biome formatter |
| `make check` | Run Biome lint + format |
| `make test` | Run Vitest |
| `make db-generate` | Generate Drizzle migrations |
| `make db-migrate` | Run Drizzle migrations |
| `make db-push` | Push Drizzle schema |
| `make db-studio` | Open Drizzle Studio |

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')

  useEffect(() => {
    getServerTime().then(setTime)
  }, [])

  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
