import React, { useState, useEffect, useMemo } from "react";
import {
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Box,
  Button,
} from "@mui/material";

const FilterComponent = ({ data, onFilter }) => {
  const [namespace, setNamespace] = useState("All");
  const [object, setObject] = useState("All");
  const [searchTitle, setSearchTitle] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");

  // Extract unique namespaces and object types based on the current filter state
  const namespaces = useMemo(() => [...new Set(data.map((item) => item.data.metadata.namespace))], [data]);
  const objects = useMemo(() => {
    const filteredData =
      namespace === "All"
        ? data
        : data.filter((item) => item.data.metadata.namespace === namespace);

    return [
      ...new Set(
        filteredData.map((item) => {
          const objectParts = item.data.involvedObject.kind;
          return objectParts; // Take only the first part of the object
        })
      ),
    ];
  }, [data, namespace]);

  // Generate filtered lists for dropdowns
  const handleFilterChange = () => {
    const filteredData = data.filter((item) => {
      const matchesNamespace = namespace === "All" || item.data.metadata.namespace === namespace;
      const matchesObject = object === "All" || item.data.involvedObject.kind === object;
      const matchesSearch = searchTitle === "" || item.data.reason.toLowerCase().includes(searchTitle.toLowerCase());
      const matchesTime = checkTimeFilter(item.data.metadata.creationTimestamp);

      return matchesNamespace && matchesObject && matchesSearch && matchesTime;
    });

    onFilter(filteredData); // Update the filtered data in parent component
  };

  const checkTimeFilter = (time) => {
    if (timeFilter === "all") return true;
    const now = new Date();
    const itemTime = new Date(time);

    switch (timeFilter) {
      case "1h":
        return now - itemTime <= 60 * 60 * 1000;
      case "10h":
        return now - itemTime <= 10 * 60 * 60 * 1000;
      case "24h":
        return now - itemTime <= 24 * 60 * 60 * 1000;
      case "1w":
        return now - itemTime <= 7 * 24 * 60 * 60 * 1000;
      case "30d":
        return now - itemTime <= 30 * 24 * 60 * 60 * 1000;
      default:
        return true;
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setNamespace("All");
    setObject("All");
    setSearchTitle("");
    setTimeFilter("all");
  };

  // Update filtered data when any of the filter values change
  useEffect(() => {
    handleFilterChange();
  }, [namespace, object, searchTitle, timeFilter, data]);

  return (
    <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
      {/* Time Filter */}
      <FormControl sx={{ minWidth: 170 }}>
        <InputLabel>Time</InputLabel>
        <Select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          label="Time"
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="1h">Last Hour</MenuItem>
          <MenuItem value="10h">Last 10 Hours</MenuItem>
          <MenuItem value="24h">Last 24 Hours</MenuItem>
          <MenuItem value="1w">Last Week</MenuItem>
          <MenuItem value="30d">Last 30 Days</MenuItem>
        </Select>
      </FormControl>

      {/* Namespace Filter */}
      <FormControl sx={{ minWidth: 170 }}>
        <InputLabel>Namespace</InputLabel>
        <Select
          value={namespace}
          onChange={(e) => {
            setNamespace(e.target.value);
            setObject("All"); // Reset object filter when namespace changes
          }}
          label="Namespace"
        >
          <MenuItem value="All">All</MenuItem>
          {namespaces.map((ns, idx) => (
            <MenuItem key={idx} value={ns}>
              {ns}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Object Filter */}
      <FormControl sx={{ minWidth: 170 }}>
        <InputLabel>Object Kind</InputLabel>
        <Select
          value={object}
          onChange={(e) => setObject(e.target.value)}
          label="Object"
        >
          <MenuItem value="All">All</MenuItem>
          {objects.map((obj, idx) => (
            <MenuItem key={idx} value={obj}>
              {obj}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Search Title */}
      <TextField
        label="Search Reason"
        variant="outlined"
        value={searchTitle}
        onChange={(e) => setSearchTitle(e.target.value)}
        sx={{ flex: 1, maxWidth: 450 }}
      />

      {/* Reset Button */}
      <Button
        variant="outlined"
        color="secondary"
        onClick={resetFilters}
        sx={{ minWidth: 150 }}
      >
        Remove All Filters
      </Button>
    </Box>
  );
};

export default FilterComponent;