import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import vehicleRoutes from "./routes/vehicle.routes";
import vehicleDocRoutes from "./routes/vehicledocroutes";
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/vehicle", vehicleRoutes);
app.use("/api/vehicledocuments", vehicleDocRoutes);

app.get("/", (req, res) => {
  res.send("API is running");
});

export default app;